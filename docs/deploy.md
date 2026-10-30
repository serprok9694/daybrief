# Деплой

| Что | Где | Деплоится |
|---|---|---|
| Web (`apps/app`) | Vercel, проект `daybrief-web` | статический Expo web export (`dist/`), SPA |
| API (`apps/api`) | Vercel, проект `daybrief-api` | Hono, собранный esbuild в одну функцию (`scripts/build-vercel.mjs` → `.vercel/output`, Build Output API) |
| БД | Supabase | миграции из `supabase/migrations` через GitHub Actions |

- **Preview:** каждый PR получает preview-деплой обоих проектов (Vercel Git integration). `npx turbo-ignore` пропускает preview-сборку проекта, если его код и зависимости не менялись.
- **Production собирается всегда** (`ignoreCommand` пропускает turbo-ignore при `VERCEL_ENV=production`): иначе ручной Redeploy после смены env-переменных отменяется как «Not affected».
- **Production:** merge в `main`.
- **Миграции:** `.github/workflows/db-migrate.yml` при пуше в `main`, если менялся `supabase/migrations/**` (или вручную: Actions → DB migrations → Run workflow). Перед этим CI на PR поднимает Postgres (`supabase db start`), применяет миграции, гоняет pgTAP-тесты (`supabase/tests`) и проверяет, что `packages/core/src/database.types.ts` совпадает с `supabase gen types`.

Настройки сборки лежат в `apps/app/vercel.json` и `apps/api/vercel.json`, а не в дашборде.

## Переменные окружения

Секреты задаются только в дашбордах (Vercel / GitHub), никогда в репозитории.

### Vercel `daybrief-web` (Production + Preview)

Всё с префиксом `EXPO_PUBLIC_` попадает в клиентский бандл, поэтому здесь только публичные значения.

| Ключ | Значение |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://daybrief-api.vercel.app` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (`sb_publishable_…`) |

Preview пока ходит в production API; отдельные preview-окружения — когда понадобятся.

### Vercel `daybrief-api` (Production + Preview, тип Sensitive)

`/health` работает без них. `SUPABASE_URL` и `SUPABASE_SECRET_KEY` нужны с T5 (`GET /me`: проверка JWT по JWKS проекта и чтение профиля). `TOKEN_ENCRYPTION_KEY` нужен с T6: `POST /connections/google` шифрует им refresh-токен Google. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` нужны с M1/T2: sync календаря меняет ими refresh token на access token (при входе Google-клиент использует Supabase). `SYNC_SECRET` нужен с M1/T3: пока он не задан, `POST /internal/sync` отвечает 503 и ничего не синхронизирует.

CORS: API отвечает браузеру только с origin web-приложения (прод, preview `daybrief-web-*-serprok9694-1239s-projects.vercel.app`, `http://localhost:8081`), список в `apps/api/src/cors.ts`.

| Ключ | Откуда |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → secret key |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud → Google Auth Platform → Clients |
| `TOKEN_ENCRYPTION_KEY` | `.env` (тот же, что локально; потеря = повторный вход всех пользователей) |
| `SYNC_SECRET` | `openssl rand -base64 32`; то же значение — в Supabase Vault (`daybrief_sync_secret`) для `pg_cron`, см. «Первичная настройка», шаг 5. Заголовок `x-sync-secret` у `POST /internal/sync` |

### GitHub Actions (Settings → Secrets and variables → Actions)

| Имя | Тип | Откуда |
|---|---|---|
| `SUPABASE_PROJECT_REF` | variable | ref из URL дашборда Supabase |
| `SUPABASE_DB_PASSWORD` | secret | пароль БД (задан при создании проекта) |
| `SUPABASE_ACCESS_TOKEN` | secret | supabase.com/dashboard/account/tokens → Generate new token (`daybrief-ci`) |

## Первичная настройка (один раз)

### 1. Vercel: проект `daybrief-web`

1. https://vercel.com/new → Import `serprok9694/daybrief`.
2. **Project Name:** `daybrief-web`.
3. **Root Directory:** Edit → `apps/app`.
4. **Framework Preset:** Other. Build / Output / Install не трогать — берутся из `vercel.json` и монорепо.
5. **Environment Variables:** три ключа из таблицы `daybrief-web` выше.
6. **Deploy.** (Первая сборка из `main` до merge T2 может упасть — это нормально, `vercel.json` появится в `main` с merge.)
7. Settings → Build and Deployment → **Node.js Version: 24.x** → Save.

### 2. Vercel: проект `daybrief-api`

1. https://vercel.com/new → снова Import `serprok9694/daybrief`.
2. **Project Name:** `daybrief-api`.
3. **Root Directory:** `apps/api`.
4. **Framework Preset:** любой — `apps/api/vercel.json` переопределяет его на `null` и собирает функцию сам.
5. Без переменных окружения → **Deploy**.
6. Settings → Build and Deployment → **Node.js Version: 24.x**.

### 3. GitHub: секреты для миграций

В своём терминале (после `gh auth login`), из корня репозитория:

```bash
gh variable set SUPABASE_PROJECT_REF --body "<project-ref>"
gh secret set SUPABASE_DB_PASSWORD
gh secret set SUPABASE_ACCESS_TOKEN
```

`gh secret set` спросит значение скрыто.

### 4. Supabase: адреса для входа

Authentication → URL Configuration:
- **Site URL:** `https://daybrief-web.vercel.app`
- **Redirect URLs:** оставить `http://localhost:8081/**`, добавить `https://daybrief-web.vercel.app/**` и `https://daybrief-web-*-serprok9694-1239s-projects.vercel.app/**` (preview).
- Для iOS/Android-сборок (позже): `daybrief://**`.

После входа Google возвращает на `/auth/callback?code=…` (PKCE), под эти маски он попадает.

### 5. Фоновый sync: `SYNC_SECRET` (M1/T3)

Каждые 15 минут `pg_cron` job `daybrief-sync` (миграция `20261030120000_calendar_sync_schedule.sql`) через `pg_net` вызывает `POST https://daybrief-api.vercel.app/internal/sync` с заголовком `x-sync-secret`. Секрет job берёт при каждом запуске из Supabase Vault (`daybrief_sync_secret`). Пока секрета в Vault нет, job ничего не отправляет. Если секрет есть в Vault, но не задан в Vercel, API отвечает 503.

1. Сгенерировать секрет в своём терминале (в чат и в репозиторий не вставлять):
   ```bash
   openssl rand -base64 32
   ```
2. Vercel → `daybrief-api` → Settings → Environment Variables → `SYNC_SECRET`, тип Sensitive, окружения **Production и Preview**. Это же значение — в локальный `.env` (`SYNC_SECRET=…`).
3. Vercel → `daybrief-api` → Deployments → последний production-деплой → **Redeploy**.
4. Supabase → SQL Editor, одна команда с тем же значением:
   ```sql
   select vault.create_secret('<значение>', 'daybrief_sync_secret');
   ```

**Замена секрета.** Сгенерировать новое значение, заменить `SYNC_SECRET` в Vercel и `.env`, сделать Redeploy, затем в SQL Editor:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'daybrief_sync_secret'),
  '<новое значение>'
);
```

Между Redeploy и `update_secret` запуски job получают 401. Это безвредно: следующий запуск через 15 минут пройдёт.

**Проверка** (SQL Editor):

```sql
-- job на месте
select jobid, schedule, active from cron.job where jobname = 'daybrief-sync';

-- последние запуски: status = 'succeeded' значит, что запрос поставлен в очередь
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'daybrief-sync')
order by start_time desc limit 5;

-- ответы API (хранятся 6 ч): ожидается status_code = 200 и счётчики в content
select status_code, content, timed_out, error_msg, created
from net._http_response order by created desc limit 5;

-- sync идёт: synced_at растёт каждые 15 минут
select user_id, synced_at, error from public.sync_state where source = 'calendar';
```

Нет строк в `net._http_response` после очередного запуска → нет секрета в Vault. 401 → значения в Vault и Vercel не совпадают. 503 → `SYNC_SECRET` не задан в Vercel или не было Redeploy.

Ручной вызов (секрет — из `.env`):

```bash
curl -sS -X POST https://daybrief-api.vercel.app/internal/sync -H "x-sync-secret: $SYNC_SECRET"
```

Ожидается 200 и только счётчики.

## Локальная БД

Нужен Docker (и ~5 ГБ свободного места под образы). CLI берётся через `npx`, версия совпадает с CI.

```bash
pnpm db:start     # локальный Supabase (API :54321, Studio :54323)
pnpm db:reset     # пересоздать БД из supabase/migrations
pnpm db:test      # pgTAP-тесты RLS из supabase/tests
pnpm db:types     # перегенерировать packages/core/src/database.types.ts после изменения схемы
```

## Проверка

- `https://daybrief-api.vercel.app/health` → `{"ok":true}`
- `https://daybrief-web.vercel.app` открывает приложение.
- У PR есть preview-ссылки от Vercel в комментарии бота.
- Actions → DB migrations → Run workflow проходит (`supabase link` + `supabase db push --linked`, без новых миграций — no-op).
