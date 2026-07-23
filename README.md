# Potato Widget Platform

An embeddable widget & lead-capture platform. Customers define widgets via an authenticated admin API, get a one-line `<script>` snippet, drop it on any external website, and submissions flow back — captured, enriched with IP→geo data, spam-filtered, and dashboarded.

Built for the FlyRank Internship — Backend Track — Week 9 — Capstone.

## Architecture

```
owner (authed) ─► CRUD /api/widgets ─► widgets (tenant-isolated) ─► embed snippet

customer site ──<script src=host/widget.js>──► GET /api/widgets/:id/config (cached, CORS) ─► render

visitor submits ─CORS POST /api/submissions─► validate ─► rate-limit/spam ─► enrich(IP→geo, fallback) ─► store ─► (safe side effect)

owner dashboard (authed) ◄── submissions + stats
```

```
┌─────────────────────────────────────────────────────────────────┐
│                     Potato Widget Platform                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐     │
│  │  Owner   │───►│  Admin API   │───►│  widgets table    │     │
│  │ (authed) │    │ /api/widgets  │    │ (tenant-isolated) │     │
│  └──────────┘    └──────────────┘    └─────────┬─────────┘     │
│                     │ snippet                   │                │
│                     ▼                           ▼                │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐     │
│  │ Customer │◄───│  widget.js   │◄───│ /api/widgets/:id  │     │
│  │   Site   │    │ (embed script)│    │   /config (cached) │     │
│  └────┬─────┘    └──────────────┘    └───────────────────┘     │
│       │ submit                                                 │
│       ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  POST /api/submissions (public, CORS)                │     │
│  │  1. Validate input                                   │     │
│  │  2. Rate limit (per IP/widget)                       │     │
│  │  3. Spam filter (honeypot + heuristic)               │     │
│  │  4. IP→Geo enrichment (3-provider fallback chain)    │     │
│  │  5. Store in submissions table                       │     │
│  │  6. Safe side effects (webhook/email — non-fatal)    │     │
│  └──────────────────────────────────────────────────────┘     │
│       │                                                        │
│       ▼                                                        │
│  ┌──────────┐    ┌──────────────────────────────┐             │
│  │ Dashboard │◄───│ /api/dashboard/submissions    │             │
│  │ (authed) │    │ /api/dashboard/stats          │             │
│  └──────────┘    └──────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/ZyadKhaled-ZK/potato-api.git
cd potato-api

# 2. Install dependencies
npm install

# 3. Copy environment file and add your credentials
cp .env.example .env
# Edit .env with your Supabase URL, key, and Postgres connection string

# 4. Start the server
npm start

# 5. Open the demo page
# http://localhost:3000/demo
```

**Requirements:** Node.js 18+, PostgreSQL (or Docker), Supabase project

## Endpoints

### Auth

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `POST` | `/auth/signup` | Sign up a new user | `{ "email", "password" }` |
| `POST` | `/auth/login` | Log in | `{ "email", "password" }` |
| `POST` | `/auth/logout` | Log out (authed) | — |

### Widgets (authenticated, tenant-isolated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/widgets` | Create a widget |
| `GET` | `/api/widgets` | List your widgets |
| `GET` | `/api/widgets/:id` | Get a widget |
| `PUT` | `/api/widgets/:id` | Update a widget |
| `DELETE` | `/api/widgets/:id` | Delete a widget |
| `GET` | `/api/widgets/:id/snippet` | Get embed snippet |

### Public (CORS-enabled)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/widgets/:id/config` | Get widget config (cached) |
| `POST` | `/api/submissions` | Submit a form |

### Dashboard (authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/submissions` | List submissions |
| `GET` | `/api/dashboard/stats` | Get stats |

### Static

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/widget.js` | Embed script (cached, immutable) |
| `GET` | `/demo` | Demo customer site |
| `GET` | `/docs` | Swagger UI |

## Security Features

### CORS
- Configurable allowed origins via `ALLOWED_ORIGINS` env var
- Preflight handling for all public endpoints
- Credentials support for authenticated routes

### Rate Limiting
- Per IP + widget: 10 requests per minute window
- Sliding window counter with automatic cleanup
- Returns `429 Too Many Requests` with honest error message

### Spam Protection
- **Honeypot field**: Hidden input that bots fill but humans don't
- **Oversized payload**: Fields > 5000 chars flagged as spam
- **Link flooding**: 3+ URLs in a single field triggers spam
- Spam submissions are stored but marked, never silently dropped

### Input Validation
- Body size limited to 100kb
- Required fields enforced at the boundary
- Honest status codes (400, 404, 429, 500)

## IP→Geo Enrichment

3-provider fallback chain:

1. **ipapi** (primary) — `ipapi.co/{ip}/json/`
2. **ip-api** (fallback) — `ip-api.com/json/{ip}`
3. **freegeoip** (last resort) — `freegeoip.app/json/{ip}`

Each provider has a 2-second timeout. If provider 1 fails, it tries provider 2, then 3. If all fail, returns `{ country: "Unknown", provider: "none" }`.

```javascript
// Toggle providers for testing
const { setProviders, resetProviders } = require('./geo');
setProviders([{ name: 'mock', fetch: async () => { throw new Error('down'); } }]);
// Now enrichment returns { provider: 'none' }
resetProviders(); // back to real providers
```

## Safe Side Effects

Webhook and email notifications are non-fatal:

```javascript
processSideEffects(submission, widget).catch(err => {
  console.warn('Side effect failed (non-fatal):', err.message);
});
```

- If `WEBHOOK_URL` is set, submissions POST to it (5s timeout)
- If `NOTIFICATION_EMAIL` + `RESEND_API_KEY` are set, sends email notification
- Neither failure affects the submission response

## Embed Script

One line to add to any site:

```html
<script src="http://localhost:3000/widget.js" data-widget-id="1" data-api-base="http://localhost:3000" async></script>
```

The script:
1. Fetches widget config from `/api/widgets/:id/config` (cached, CORS)
2. Renders a popover/signup/CTA form
3. Submits data back to `/api/submissions` (CORS)
4. Shows success/error feedback inline

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_KEY` | Supabase anon key | Yes |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | No |
| `WEBHOOK_URL` | Webhook URL for submissions | No |
| `NOTIFICATION_EMAIL` | Email for notifications | No |
| `RESEND_API_KEY` | Resend API key for emails | No |

## Database Schema

```sql
-- Widgets (tenant-isolated)
CREATE TABLE widgets (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'popover',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  fields JSONB DEFAULT '[]',
  targeting JSONB DEFAULT '{}',
  button_text TEXT DEFAULT 'Submit',
  theme JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Submissions
CREATE TABLE submissions (
  id SERIAL PRIMARY KEY,
  widget_id INTEGER REFERENCES widgets(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  geo JSONB DEFAULT '{}',
  is_spam BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rate limits
CREATE TABLE rate_limits (
  ip TEXT NOT NULL,
  widget_id INTEGER NOT NULL,
  window_start TIMESTAMPTZ DEFAULT now(),
  count INTEGER DEFAULT 1,
  PRIMARY KEY (ip, widget_id, window_start)
);
```

## Tests

```bash
npm test
```

19 tests covering:
- CORS preflight and headers
- Input validation (missing fields, empty data)
- Auth (unauthenticated access blocked)
- Spam detection (honeypot, oversized payloads)
- Geo enrichment (local IP, provider fallback)
- Static assets (widget.js, demo page)
- Rate limiting (with DB)
- Health check and API info

## Project Structure

```
potato-api/
  server.js           # Express app — all routes + CORS + widget platform
  db.js               # PostgreSQL connection + schema (tasks, widgets, submissions, rate_limits)
  geo.js              # IP→Geo enrichment with 3-provider fallback chain
  spam.js             # Rate limiter + spam detection (honeypot, heuristic)
  supabase.js         # Supabase client initialization
  test.js             # 19 tests (CORS, validation, spam, geo, auth, rate-limit)
  public/
    widget.js         # Embeddable script (cross-origin, renders form, submits data)
    customer-site.html # Demo "customer site" with widget embedded
  Dockerfile          # Container image
  compose.yaml        # App + Postgres stack
  .env.example        # Template for secrets
  .env                # Real secrets (git-ignored)
  package.json
  README.md
```

## AI vs Me (Week 9 — Capstone)

### My Prompt

> Build an embeddable widget platform with Express. Widget CRUD with tenant isolation
> via Supabase Auth. Public embed script that fetches config and renders on any origin.
> CORS on all public endpoints. Submission endpoint with input validation, rate limiting
> per IP/widget (10/min), honeypot spam detection, and IP→geo enrichment with 3-provider
> fallback chain (ipapi, ip-api, freegeoip). Safe side effects — webhook/email that don't
> fail the submission. Cached config delivery with cache headers. Dashboard with stats.
> 19 tests covering CORS, validation, spam, geo, auth, rate-limit.

### What the AI Did Better

- Generated a full embed script with themed UI (positioning, colors, responsive design)
- Added `stale-while-revalidate` cache header for config — serves stale while refreshing
- Created a comprehensive test suite with graceful DB-unavailable handling
- Added automatic rate limit cleanup via `setInterval`

### What It Got Wrong or Ignored

- Initial package.json had syntax error (extra closing brace)
- Server crashed on DB errors without try/catch — had to add error handling manually
- Embed script had syntax error (`field honeypot` instead of `field.honeypot`)
- Didn't handle Express 5 async error propagation (v5 doesn't auto-catch)

### What My Prompt Forgot

- Didn't specify Express version compatibility (v5 async behavior differs from v4)
- Didn't mention stale-while-revalidate or ETag headers
- Didn't specify rate limit cleanup strategy
- Didn't mention body size limits

### Second Prompt Change

Added requirements for: try/catch on all DB-dependent routes, body size limit (100kb), rate limit cleanup interval, and Express 5 async error handling. The second version matched my hand-built implementation.

## License

ISC
