# meal-mcp — дневник питания как коннектор Claude

Фото еды отправляешь в приложение Claude, Claude оценивает КБЖУ и сам записывает приём пищи в `meals`.
Работает по подписке Claude, API-кредиты не нужны.

Инструменты: `log_meal` (записать еду) и `get_day` (итог дня). Удалять, менять тренировки или читать
что-то кроме питания коннектор не умеет. Правка и удаление записей — только в приложении.

## Подключение (один раз)

1. **Миграция питания** `20261114120000_nutrition.sql` должна быть применена.
2. **Твой user id** — в SQL Editor: `select id, email from auth.users;`
3. **Секрет для URL** — 64 случайных символа: `openssl rand -hex 32`
4. **Секреты функции** — Supabase → Edge Functions → Secrets (или CLI):
   ```bash
   npx supabase secrets set MCP_SECRET=<из шага 3> MCP_USER_ID=<из шага 2> --project-ref <ref>
   ```
5. **Деплой** — CLI или панель (Edge Functions → Deploy a new function, имя `meal-mcp`, Verify JWT выключить):
   ```bash
   npx supabase functions deploy meal-mcp --project-ref <ref>
   ```
6. **claude.ai** → Settings → Connectors → Add custom connector:
   - Name: `Дневник питания`
   - URL: `https://<ref>.supabase.co/functions/v1/meal-mcp/<MCP_SECRET>`

   Коннектор появится и в мобильном приложении Claude.

## Использование

Фото тарелки в чат Claude + «запиши» (можно с уточнением: «рис 150 г»). Claude покажет, что записал,
и итог дня против целей. «Сколько белка осталось?» — вызовет `get_day`.

Если Claude не зовёт инструмент сам — создай Project с инструкцией:
«Когда я присылаю фото еды — оцени КБЖУ и запиши через log_meal».

## Безопасность

- URL с секретом = пароль. Не публикуй его; утёк — смени `MCP_SECRET` и обнови URL коннектора.
- Функция пишет через service role (обходит RLS), поэтому `user_id` всегда берётся из `MCP_USER_ID`,
  а код трогает только `meals` (insert/select) и `profiles` (select).
- Неверный секрет → 404, как будто функции нет.
