# AGENTS.md

Vue 3 + Vite + TypeScript modular frontend (`mutidoc-front`). Docs and UI text are Chinese.
Package manager is **pnpm** (`pnpm-lock.yaml`; version pinned to 11.1.1 in `Dockerfile`) — not npm/yarn.

## Commands

- `pnpm install`
- `pnpm dev` — Vite dev server on :5173; proxies `/api` to `http://localhost:8080`
- `pnpm build` — **the only verification step**: `vue-tsc -b` (typecheck) then `vite build`
- `pnpm preview` — serve the built `dist/`

There is no ESLint / Prettier / Vitest config and no lint or test script. Do not invent one.
To run just the typecheck: `pnpm exec vue-tsc -b`.

## Architecture

- `@` aliases `src` in both `vite.config.ts` and `tsconfig.app.json`; keep the two in sync.
- **Module routes are auto-collected**: `src/router/routes.ts` uses
  `import.meta.glob('../modules/*/routes.ts', { eager: true })`. Never edit the router to register a
  module route; add `routes.ts` in the module instead (relative paths, `name` = `<module>-<action>`).
- New feature = copy `src/modules/example/` (its `README.md` is the reference template). A module is
  self-contained (`api / stores / components / views / routes / types`) and exposes **only** `index.ts`;
  other modules must import through `index.ts`, never deep internal paths.
- Unidirectional data flow: **View → store action → `api/*.ts` → `request()` → backend**. Views never
  call the API directly; stores never touch DOM/Router. Business-agnostic code belongs only in
  `src/components`, `src/composables`, `src/utils`.
- `src/config/env.ts` is the **only** place allowed to read `import.meta.env`; business code imports
  `env` from there.

## API layer

- `request<T>()` from `@/api` is the only HTTP entrypoint. It uses the global axios instance,
  auto-injects `Authorization: Bearer <token>` from `localStorage['md_token']`, unwraps the
  `{ code, message, data }` envelope, and throws `ApiError` when `code !== 0`. It returns `data`
  directly (or `undefined` for empty / 204 bodies).
- Module APIs branch on `env.useMock`; mocks live in that module's `api/mock.ts`.
- `.env` defaults to `VITE_USE_MOCK=true` (runs without a backend); `.env.production` sets it to
  `false`. All client vars must start with `VITE_`.

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
network `mutidoc-net`**, created by the Server repo, and expose `8890:80`):

- **Dev** — `Dockerfile` + `docker-compose.yml`: runs `pnpm dev` (Vite dev server + HMR) with the
  project bind-mounted; `/api` is proxied via `DEV_PROXY_TARGET`. No image rebuild needed on source
  changes, only on dependency changes.
- **Prod** — `Dockerfile.prod` + `docker-compose.prod.yml`: multi-stage `pnpm build` then nginx
  serves `dist` (`deploy/nginx/default.conf`); `/api/` proxies to `nginx-gateway:8081`. `VITE_` vars
  are injected at **build time**, so any env change requires
  `docker compose -f docker-compose.prod.yml build`.

See `deploy/README.md`.
