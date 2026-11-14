// supabase/functions/estimate-meal/index.ts — Supabase Edge Function (Deno 2)
// Фото еды → Claude (vision + structured output) → оценка КБЖУ по продуктам.
// Ключ Claude API живёт только здесь, в секретах Supabase: supabase secrets set ANTHROPIC_API_KEY=…
// Ничего не пишет в базу: клиент показывает черновик, пользователь правит и сохраняет сам.
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5-5';
const MAX_IMAGE_B64 = 2_000_000; // ~1,5 МБ; клиент жмёт до 1024 px JPEG, это ~150–300 КБ
const MAX_COMMENT = 300;
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const CORS = {
  'Access-Control-Allow-Origin': '*', // авторизация — Bearer-токеном, не куками
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SYSTEM = `Ты — нутрициолог. По фото еды оцениваешь калорийность и БЖУ.
Пользователь живёт в Ташкенте: учитывай местную кухню (плов, лагман, самса, манты, шурпа, лепёшка) и типичные порции.

Правила:
- Разбей блюдо на составляющие, которые видно на фото (гарнир, мясо, соус, хлеб, напиток). Сложное блюдо (плов, лагман) — одной позицией.
- Граммы — вес в готовом виде, как лежит на тарелке. Оценивай по размеру тарелки, приборов, рук.
- Учитывай масло и жир при готовке: жареное и плов калорийнее варёного.
- Комментарий пользователя важнее фото: если он указал вес или состав — бери его.
- КБЖУ считай для указанных граммов, а не на 100 г. Белки, жиры, углеводы — в граммах.
- Если не уверен в порции — выбери середину правдоподобного диапазона и напиши в notes, что уточнить.
- Если на фото не еда — is_food = false, items пустой.
- Названия — по-русски, коротко: «Рис отварной», «Куриная грудка гриль».`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'title', 'items', 'confidence', 'notes'],
  properties: {
    is_food: { type: 'boolean' },
    title: { type: 'string', description: 'Короткое название приёма пищи, 1–4 слова' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal', 'protein', 'fat', 'carbs'],
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          fat: { type: 'number' },
          carbs: { type: 'number' },
        },
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    notes: { type: 'string', description: 'Что неточно и что стоит уточнить; пусто, если всё ясно' },
  },
} as const;

interface Body {
  readonly image?: unknown;
  readonly mediaType?: unknown;
  readonly comment?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Только POST' });

  // 1. Кто зовёт. verify_jwt выключен в config.toml (с новыми ключами Supabase шлюз его не проверяет) — проверяем сами.
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return json(500, { error: 'Нет SUPABASE_URL / SUPABASE_ANON_KEY в окружении функции' });
  const { data: auth, error: authError } = await createClient(url, anon).auth.getUser(jwt);
  if (authError || !auth.user) return json(401, { error: 'Нужен вход' });

  // 2. Что прислали
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Тело — JSON' });
  }
  const { image, mediaType, comment } = body;
  if (typeof image !== 'string' || image.length === 0) return json(400, { error: 'Нет фото' });
  if (image.length > MAX_IMAGE_B64) return json(413, { error: 'Фото слишком большое' });
  if (!MEDIA_TYPES.includes(mediaType as MediaType)) return json(400, { error: 'Формат фото: JPEG, PNG или WebP' });
  const note = typeof comment === 'string' ? comment.trim().slice(0, MAX_COMMENT) : '';

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(500, { error: 'Не задан секрет ANTHROPIC_API_KEY' });

  // 3. Claude: фото + комментарий → JSON по схеме
  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // если классификатор безопасности вдруг откажет — API сам повторит запрос на рекомендованной модели
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as MediaType, data: image } },
            { type: 'text', text: note ? `Комментарий: ${note}` : 'Оцени, что на фото.' },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') return json(422, { error: 'Claude не стал оценивать это фото' });
    if (response.stop_reason === 'max_tokens') return json(502, { error: 'Ответ оборвался — попробуй ещё раз' });

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json(502, { error: 'Пустой ответ модели' });

    return json(200, {
      estimate: JSON.parse(text.text),
      model: response.model,
      usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json(500, { error: 'Неверный ANTHROPIC_API_KEY' });
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: 'Лимит Claude API — подожди минуту' });
    if (e instanceof Anthropic.APIError) return json(502, { error: `Claude API ${e.status ?? ''}: ${e.message}` });
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
