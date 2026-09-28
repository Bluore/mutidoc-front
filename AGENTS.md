# AGENTS.md

Vue 3 + Vite + TypeScript modular frontend (`mutidoc-front`). Docs, code comments, and UI text are
Chinese — write in Chinese. Package manager is **pnpm** (`pnpm-lock.yaml`; pinned to 11.1.1 in both
Dockerfiles) — not npm/yarn.

## Commands

- `pnpm install`
- `pnpm dev` — Vite on :5173 (binds all interfaces); `/api` is proxied (see Dev proxy)
- `pnpm build` — **the only verification step**: `vue-tsc -b` (typecheck) then `vite build`
- `pnpm preview` — serve the built `dist/`
- Typecheck only: `pnpm exec vue-tsc -b`

There is no ESLint / Prettier / Vitest config and no lint or test script. Do not invent one.

## Architecture

- `@` aliases `src` in both `vite.config.ts` and `tsconfig.app.json`; keep the two in sync.
- **Module routes are auto-collected**: `src/router/routes.ts` globs
  `../modules/*/routes.ts`. Never edit the router to register a module route; add `routes.ts` in the
  module instead (relative paths; `name` = `<module>-<action>`).
- Route `meta` conventions (guard in `src/router/index.ts`): all `DefaultLayout` children are
  auth-guarded via the parent's `meta.requiresAuth`; `meta.layout = 'blank'` promotes a route to
  top-level (no layout) — used by `/login` and `/register`; `meta.guestOnly` redirects logged-in
  users home; `meta.title` sets the document title.
- Modules: `example` is the minimal copy-me template; `auth`, `user`, `document` are real
  implementations. A module is self-contained (`api / stores / components / views / routes / types`)
  and exposes **only** `index.ts`; other modules import through it, never deep internal paths.
- Unidirectional data flow: **View → store action → `api/*.ts` → `request()` → backend**. Views never
  call the API directly; stores never touch DOM/Router. Business-agnostic code belongs only in
  `src/components`, `src/composables`, `src/utils`.
- `src/config/env.ts` is the **only** place allowed to read `import.meta.env`; import `env` from there.
- UI primitives come from `@pixelium/web-vue` (e.g. `PxForm`); prefer it over hand-rolled inputs.

## API layer

- `request<T>()` from `@/api` is the only HTTP entrypoint (global axios). It injects
  `Authorization: Bearer <localStorage['md_token']>`, unwraps the `{ code, msg, data }` envelope,
  returns `data` (or `undefined` for empty / 204 bodies), and throws `ApiError` when `code !== 0`.
  It tolerates both `msg` and `message`.
- **Most business errors are HTTP 200 with a non-zero `code`; only auth failure is 401.** Never judge
  success by HTTP status — rely on `request()`'s `code` check. On 401 the interceptor clears the token
  and redirects to `/login`.
- Auth state: `useAuthStore` persists `md_token` plus an absolute `md_token_expire` (Unix **seconds**);
  the route guard calls `ensureFresh()` to drop expired credentials.
- Module APIs branch on `env.useMock`; mocks live in that module's `api/mock.ts`.
  **`.env` defaults to `VITE_USE_MOCK=false`** (real backend); set `true` to run without a backend.
- `env.apiBaseUrl` is `/api`, so module APIs write only the path after that prefix
  (`/user/v1/login`, `/doc/v1/document/list`).
- `docs/*.md` are the backend API contracts (paths, error codes) but lag the code — when they
  disagree, trust the module `README.md` and source.

## Dev proxy & gotchas

- `pnpm dev` proxies `/api` to `DEV_PROXY_TARGET` (default `http://localhost:8888`, the Server-side
  gateway; in-container `http://nginx-gateway:8081`) with `ws: true`.
- `dev-get-body-shim` (dev only): some backend GET endpoints declare their input as a JSON **body**,
  which browsers refuse to send. The Vite middleware rewrites `GET /api/...?query` into a JSON-body
  GET. Disable with `DEV_GET_BODY_SHIM=false`. **Production has no shim** — those endpoints need the
  backend to accept query params (`form:`) or POST (affects `GET /doc/v1/document/list` and `/info`).
- CodeMirror: `@codemirror/state|view|commands` are `dedupe`d and pre-bundled via `optimizeDeps` to
  avoid duplicate instances / dynamic-import reload errors. Preserve this when editing `vite.config.ts`.

## Collaboration / OT (document module)

- WebSocket endpoint derives from `origin + env.apiBaseUrl` (`/doc/v1/document/edit?document_id=`) or
  `VITE_COLLAB_WS_URL`.
- Browsers cannot set a WS `Authorization` header, so the token is sent in the **first `init` frame**.
  All OT operator positions/lengths are **UTF-8 byte offsets**.
- `ot/ot-client.ts` is the single source of truth for merge state; **do not use `@codemirror/collab`**
  (its merge rules differ from the backend `pkg/ot`). `ot/` is pure (no DOM/IO/Router), transport is
  `ot/connection.ts`, orchestration is `stores/collaboration.ts`.
- Backend document body is in-memory only (lost on server restart).

## Styling (enforced convention)

- Every component `<style>` is `scoped`. Global CSS lives only in `src/styles/`.
- Class names are BEM + module prefix; utility classes use the `md-` prefix.
- Use design tokens `var(--md-*)`; never hardcode colors/spacing. `!important` is banned; `:deep()` is
  only for overriding third-party internals and must carry a comment. Details: `src/styles/README.md`.

## TypeScript strictness

`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `erasableSyntaxOnly` are on.
`erasableSyntaxOnly` forbids enums, namespaces, and constructor parameter properties — use union types
(the codebase convention is union types instead of `enum`).

## Deploy

Two flavors, each with its own Dockerfile + compose file (both join the **pre-existing external
network `mutidoc-net`**, created by the Server repo, expose `8890:80`, and use
`container_name: mutidoc-front` — so dev and prod cannot run at the same time):

- **Dev** — `Dockerfile` + `docker-compose.yml`: runs `pnpm dev` (HMR) with the source bind-mounted
  (`.:/app`, `node_modules` shadowed by an anonymous volume). Rebuild only on dependency changes.
- **Prod** — `Dockerfile.prod` + `docker-compose.prod.yml`: multi-stage `pnpm build` then nginx
  serves `dist` (`deploy/nginx/default.conf`); `/api/` proxies to `nginx-gateway:8081`. `VITE_` vars
  are injected at **build time**, so any env change requires a rebuild
  (`docker compose -f docker-compose.prod.yml build`).

Docker installs default to the `registry.npmmirror.com` npm registry (override with the
`NPM_REGISTRY` build arg). See `deploy/README.md`.
