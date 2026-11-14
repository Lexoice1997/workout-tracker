// supabase/functions/meal-mcp/index.ts — свой MCP-коннектор для claude.ai (Supabase Edge Function, Deno 2)
//
// Зачем: фото еды отправляешь в приложение Claude (по подписке, без API-кредитов), Claude оценивает КБЖУ
// и сам записывает приём пищи сюда. В отличие от официального коннектора Supabase с записью,
// этот умеет ровно две вещи: добавить еду и показать итог дня. Удалить, изменить тренировки,
// прочитать что-то кроме питания — нельзя.
//
// Протокол: MCP Streamable HTTP без сессий — POST с JSON-RPC, ответ JSON. SSE не нужен.
// Доступ: секрет в пути URL (claude.ai умеет только OAuth или URL без заголовков):
//   https://<project>.supabase.co/functions/v1/meal-mcp/<MCP_SECRET>
// Секреты функции: MCP_SECRET (≥ 32 случайных символа), MCP_USER_ID (uuid твоего пользователя).

import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type Slot = (typeof SLOTS)[number];
const SLOT_RU: Record<Slot, string> = { breakfast: 'завтрак', lunch: 'обед', dinner: 'ужин', snack: 'перекус' };

// ───────────────────────── окружение

const SECRET = Deno.env.get('MCP_SECRET') ?? '';
const USER_ID = Deno.env.get('MCP_USER_ID') ?? '';
const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// service role обходит RLS, поэтому user_id ставим сами — всегда MCP_USER_ID, и трогаем только meals/profiles
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// ───────────────────────── инструменты

const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'grams', 'kcal', 'protein', 'fat', 'carbs'],
  properties: {
    name: { type: 'string', description: 'Короткое название по-русски: «Рис отварной»' },
    grams: { type: 'number', description: 'Вес в готовом виде, г' },
    kcal: { type: 'number', description: 'Ккал на указанные граммы (не на 100 г)' },
    protein: { type: 'number', description: 'Белки, г на указанные граммы' },
    fat: { type: 'number', description: 'Жиры, г на указанные граммы' },
    carbs: { type: 'number', description: 'Углеводы, г на указанные граммы' },
  },
};

const TOOLS = [
  {
    name: 'log_meal',
    title: 'Записать приём пищи',
    description:
      'Записывает приём пищи в дневник питания. Используй, когда пользователь прислал фото еды или описал, что съел. ' +
      'Сначала оцени состав: разбей на продукты, оцени вес в готовом виде по размеру тарелки и приборов, учти масло при жарке, ' +
      'учитывай узбекскую кухню (плов, лагман, самса, манты). Если пользователь указал вес или состав — бери его. ' +
      'КБЖУ считай на указанные граммы. После записи коротко покажи, что записал, и итог дня из ответа инструмента.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'items'],
      properties: {
        title: { type: 'string', description: 'Название приёма пищи, 1–4 слова: «Плов с салатом»' },
        items: { type: 'array', minItems: 1, maxItems: 30, items: ITEM_SCHEMA },
        slot: { type: 'string', enum: SLOTS, description: 'Если не указан — по текущему времени пользователя' },
        date: { type: 'string', description: 'YYYY-MM-DD. Если не указана — сегодня в поясе пользователя' },
        note: { type: 'string', description: 'Что неточно в оценке, если есть' },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'get_day',
    title: 'Итог дня по питанию',
    description: 'Показывает, что съедено за день, итог КБЖУ и сколько осталось до цели по калориям и белку.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { date: { type: 'string', description: 'YYYY-MM-DD. Если не указана — сегодня' } },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const;

// ───────────────────────── доменная логика (копия малой части libs/domain: функция деплоится отдельно)

interface Item { name: string; grams: number; kcal: number; protein: number; fat: number; carbs: number }
interface Macros { kcal: number; protein: number; fat: number; carbs: number }

const r1 = (n: number) => Math.round(n * 10) / 10;
const sum = (list: Macros[]): Macros => {
  const s = list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, fat: a.fat + m.fat, carbs: a.carbs + m.carbs }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 });
  return { kcal: r1(s.kcal), protein: r1(s.protein), fat: r1(s.fat), carbs: r1(s.carbs) };
};
const slotByHour = (h: number): Slot =>
  h >= 4 && h < 11 ? 'breakfast' : h >= 11 && h < 16 ? 'lunch' : h >= 18 && h < 23 ? 'dinner' : 'snack';
const isIsoDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

class ToolError extends Error {}

function parseItems(raw: unknown): Item[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 30) throw new ToolError('items: от 1 до 30 продуктов');
  return raw.map((it, i) => {
    const o = (typeof it === 'object' && it !== null ? it : {}) as Record<string, unknown>;
    const name = typeof o['name'] === 'string' ? o['name'].trim().slice(0, 120) : '';
    if (!name) throw new ToolError(`items[${i}].name пустое`);
    const num = (k: string, max: number) => {
      const v = Number(o[k]);
      if (!Number.isFinite(v) || v < 0 || v > max) throw new ToolError(`items[${i}].${k}: число от 0 до ${max}`);
      return r1(v);
    };
    return { name, grams: num('grams', 5000), kcal: num('kcal', 10000), protein: num('protein', 1000), fat: num('fat', 1000), carbs: num('carbs', 1000) };
  });
}

async function userNow(): Promise<{ date: string; hour: number; targets: { kcal: number | null; protein: number | null } }> {
  const { data, error } = await db.from('profiles').select('timezone, kcal_target, protein_target_g').eq('user_id', USER_ID).maybeSingle();
  if (error) throw new Error(error.message);
  const timeZone = data?.timezone ?? 'Asia/Tashkent';
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  return { date, hour, targets: { kcal: data?.kcal_target ?? null, protein: data?.protein_target_g ?? null } };
}

async function dayText(date: string, targets: { kcal: number | null; protein: number | null }): Promise<string> {
  const { data, error } = await db
    .from('meals')
    .select('title, slot, kcal, protein_g, fat_g, carbs_g')
    .eq('user_id', USER_ID)
    .eq('date', date)
    .order('created_at');
  if (error) throw new Error(error.message);
  const meals = data ?? [];
  if (meals.length === 0) return `${date}: записей нет.`;
  const t = sum(meals.map((m) => ({ kcal: Number(m.kcal), protein: Number(m.protein_g), fat: Number(m.fat_g), carbs: Number(m.carbs_g) })));
  const left = (v: number, target: number | null, unit: string) =>
    target === null ? '' : v <= target ? ` (осталось ${Math.round(target - v)} ${unit})` : ` (перебор ${Math.round(v - target)} ${unit})`;
  const lines = meals.map((m) => `- ${SLOT_RU[m.slot as Slot] ?? m.slot}: ${m.title} — ${Math.round(Number(m.kcal))} ккал, Б ${Math.round(Number(m.protein_g))}`);
  return [
    `${date}, итог: ${Math.round(t.kcal)}${targets.kcal ? ` / ${targets.kcal}` : ''} ккал${left(t.kcal, targets.kcal, 'ккал')}, ` +
      `белок ${Math.round(t.protein)}${targets.protein ? ` / ${targets.protein}` : ''} г${left(t.protein, targets.protein, 'г')}, ` +
      `жиры ${Math.round(t.fat)} г, углеводы ${Math.round(t.carbs)} г.`,
    ...lines,
  ].join('\n');
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const now = await userNow();
  if (name === 'get_day') {
    const date = args['date'] === undefined ? now.date : args['date'];
    if (!isIsoDate(date)) throw new ToolError('date: формат YYYY-MM-DD');
    return dayText(date, now.targets);
  }
  if (name === 'log_meal') {
    const title = typeof args['title'] === 'string' ? args['title'].trim().slice(0, 120) : '';
    if (!title) throw new ToolError('title пустое');
    const items = parseItems(args['items']);
    const date = args['date'] === undefined ? now.date : args['date'];
    if (!isIsoDate(date)) throw new ToolError('date: формат YYYY-MM-DD');
    if (date > now.date) throw new ToolError('date в будущем');
    const slot = args['slot'] === undefined ? slotByHour(now.hour) : args['slot'];
    if (!SLOTS.includes(slot as Slot)) throw new ToolError(`slot: одно из ${SLOTS.join(', ')}`);
    const note = typeof args['note'] === 'string' && args['note'].trim() ? args['note'].trim().slice(0, 500) : null;
    const t = sum(items);
    const { error } = await db.from('meals').insert({
      user_id: USER_ID, date, slot, title, items, kcal: t.kcal, protein_g: t.protein, fat_g: t.fat, carbs_g: t.carbs,
      source: 'photo', note,
    });
    if (error) throw new Error(error.message);
    return `Записано: ${title} (${SLOT_RU[slot as Slot]}, ${date}) — ${Math.round(t.kcal)} ккал, ` +
      `Б ${Math.round(t.protein)} / Ж ${Math.round(t.fat)} / У ${Math.round(t.carbs)}. ` +
      `Поправить или удалить — в приложении, раздел «Питание».\n\n${await dayText(date, now.targets)}`;
  }
  throw new ToolError(`Нет инструмента ${name}`);
}

// ───────────────────────── JSON-RPC

interface Rpc { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id, result });
const fail = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function handle(msg: Rpc): Promise<object | null> {
  if (msg.id === undefined || msg.id === null) return null; // уведомление (notifications/initialized и т. п.) — ответа нет
  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.['protocolVersion'] ?? '');
      return ok(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'workout-tracker-meals', title: 'Дневник питания', version: '1.0.0' },
        instructions:
          'Дневник питания пользователя. Фото еды или описание съеденного → оцени КБЖУ и вызови log_meal. ' +
          'Вопросы «сколько я съел», «сколько осталось белка» → get_day.',
      });
    }
    case 'ping':
      return ok(msg.id, {});
    case 'tools/list':
      return ok(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = String(msg.params?.['name'] ?? '');
      const args = (msg.params?.['arguments'] ?? {}) as Record<string, unknown>;
      try {
        return ok(msg.id, { content: [{ type: 'text', text: await callTool(name, args) }] });
      } catch (e) {
        // ошибка инструмента — в результат, чтобы Claude увидел текст и поправил аргументы
        return ok(msg.id, { content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }], isError: true });
      }
    }
    default:
      return fail(msg.id, -32601, `Метод не поддерживается: ${msg.method}`);
  }
}

/** Сравнение без утечки по времени */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (SECRET.length < 32 || !USER_ID || !url || !serviceKey) return json(500, { error: 'Не заданы MCP_SECRET (≥ 32 символа) / MCP_USER_ID' });

  // /functions/v1/meal-mcp/<secret> — секрет последний сегмент пути
  const given = new URL(req.url).pathname.split('/').filter(Boolean).at(-1) ?? '';
  if (!safeEqual(given, SECRET)) return json(404, { error: 'Not found' });

  if (req.method === 'GET') return new Response(null, { status: 405, headers: { Allow: 'POST' } }); // SSE-поток не держим
  if (req.method === 'DELETE') return new Response(null, { status: 405, headers: { Allow: 'POST' } }); // сессий нет
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, fail(null, -32700, 'Parse error'));
  }

  if (Array.isArray(body)) { // батч из старой версии протокола
    const out = (await Promise.all(body.map((m) => handle(m as Rpc)))).filter((r) => r !== null);
    return out.length ? json(200, out) : new Response(null, { status: 202 });
  }
  const res = await handle(body as Rpc);
  return res === null ? new Response(null, { status: 202 }) : json(200, res);
});
