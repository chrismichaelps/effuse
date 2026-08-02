<p align="center">
  <img src="public/banner/banner_readme.svg" alt="Effuse" width="100%" />
</p>

<p align="center">
  A TypeScript application framework for fine-grained interfaces, typed capability layers, and portable server APIs.
</p>

Effuse treats application capabilities as one graph. A layer can own browser
services, state, lifecycle, server routes, actions, middleware, and policy;
components and hooks consume that graph through typed local aliases. The goal is
to keep UI and server contracts explicit without rebuilding the same capability
around unrelated framework primitives.

> **Project status:** Experimental. Effuse has production-oriented runtime,
> conformance, security, and packaging tests, but does not yet provide a stable
> production compatibility contract. See [Production Readiness](https://github.com/chrismichaelps/effuse/wiki/Production-Readiness).

## Why Effuse

- **Fine-grained reactivity:** signals and computed values update their
  dependents without component-tree rerenders by default.
- **One component vocabulary:** `define({ script, template })` keeps reactive
  setup, lifecycle, capabilities, and rendering in one typed contract.
- **Explicit capability ownership:** layers compose services, components,
  hooks, policies, and server endpoints at the application root.
- **Typed server APIs:** layer routes and file-derived handlers share request
  schemas, typed failures, manifests, middleware, caching, and generated clients.
- **Portable server runtime:** Web `Request`/`Response` handlers run through
  tested Node and Bun adapters with graceful shutdown and streaming support.
- **Framework-owned schemas:** application code can validate props and server
  requests without importing or learning Effuse's internal Effect runtime.

## Component And Layer Model

```tsx
import { createApp, define, defineLayer, signal } from '@effuse/core';

const CounterLayer = defineLayer({
	name: 'counter',
	services: {
		counter: () => {
			const count = signal(0);
			return { count, increment: () => count.value++ };
		},
	},
});

const CounterButton = define({
	layers: { counter: CounterLayer } as const,
	script({ layers }) {
		return layers.counter.service('counter');
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>Count: {count}</button>
	),
});

const app = await createApp(CounterButton).useLayers([CounterLayer]);
await app.mount('#app');
```

`useLayers(...)` is the composition root. A component's `layers` record creates
typed local bindings; it does not register or mutate the running graph. Missing
registrations fail before user setup runs with an actionable diagnostic.

## Server APIs

Effuse supports layer-owned endpoints and file-derived routes under
`src/server/api`. A path-aware handler keeps route params, request input, and
response output in one contract:

```ts
// src/server/api/users/[id]/route.ts
import {
	defineServerFileHandler,
	defineServerRequest,
	serverSchema,
} from '@effuse/core/server';

export const request = defineServerRequest({
	params: serverSchema.object({ id: serverSchema.string }),
	query: serverSchema.object({
		limit: serverSchema.optional(serverSchema.numberFromString, 20),
	}),
});

export const response = serverSchema.object({
	id: serverSchema.string,
	limit: serverSchema.number,
});

export const GET = defineServerFileHandler(
	'/api/users/[id]',
	{ request, response },
	({ input }) => ({
		id: input.params.id,
		limit: input.query.limit,
	})
);
```

The CLI discovers API and action files, detects route collisions, and emits a
lazy compiled registry. The core dispatcher applies middleware, request
contracts, cache policy, typed failures, and route matching. `@effuse/server`
then hosts the resulting Web-standard handler on Node or Bun.

Read [Routing, SSR, And Server APIs](https://github.com/chrismichaelps/effuse/wiki/Routing-SSR-And-Server-APIs)
and [Server Request Schemas](https://github.com/chrismichaelps/effuse/wiki/Server-Request-Schemas)
for the full contract.

## Packages

| Package            | Responsibility                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `@effuse/core`     | Signals, components, DOM rendering, layers, SSR, server routes/actions, middleware, schemas, manifests, and typed clients. |
| `@effuse/auth`     | Typed sessions, credentials, OAuth/OIDC, token refresh, authorization policies, SSR hydration, and conformance suites.     |
| `@effuse/router`   | Histories, route matching, nested views, navigation, guards, links, and route context.                                     |
| `@effuse/store`    | Reactive application state, actions, middleware, persistence, validation, selectors, and devtools integration.             |
| `@effuse/query`    | Server-state caching, observers, retries, mutations, hydration, invalidation, and optimistic updates.                      |
| `@effuse/use`      | Reusable browser and lifecycle hooks with framework-owned public types.                                                    |
| `@effuse/i18n`     | Reactive locale state, translation lookup, interpolation, pluralization, formatting, fallback, and scoped messages.        |
| `@effuse/ink`      | Markdown parsing and reactive rendering with component embedding, URL sanitization, and SSR-safe styles.                   |
| `@effuse/compiler` | JSX/TSX transformation, reactive access optimization, source maps, caching, and Vite integration.                          |
| `@effuse/cli`      | Development server, production builds, generated entries, and compiled server/middleware registries.                       |
| `@effuse/server`   | Portable server contracts, Node/Bun adapters, storage, scheduled tasks, plugins, conformance, and graceful shutdown.       |

Package boundaries and current status are indexed in
[Packages And Tooling](https://github.com/chrismichaelps/effuse/wiki/Packages-And-Tooling).

## Repository Development

The repository requires Node `>=22.14.0` and pnpm `10.32.1`. `.nvmrc` and
`.node-version` pin the supported local runtime. Use Bun for the integration-app
and Bun-adapter gates where specified.

```bash
nvm use
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
bun run check:app:bun
pnpm --filter @effuse/server test:bun
```

`pnpm test` runs every publishable package suite. A repository contract fails
the gate if a package with tests lacks a test command or masks child failures.
The ignored `app/` directory is the local dogfood application used to exercise
cross-package browser and server workflows; it is not a generated E2E fixture.

## Documentation

- [Effuse Wiki](https://github.com/chrismichaelps/effuse/wiki)
- [Getting Started](https://github.com/chrismichaelps/effuse/wiki/Getting-Started)
- [Why Effuse](https://github.com/chrismichaelps/effuse/wiki/Why-Effuse)
- [Reference Index](https://github.com/chrismichaelps/effuse/wiki/Reference-Index)
- [Layers And Capabilities](https://github.com/chrismichaelps/effuse/wiki/Layers-And-Capabilities)
- [Runnable Examples](https://github.com/chrismichaelps/effuse/wiki/Runnable-Examples)
- [DX Gaps And Roadmap](https://github.com/chrismichaelps/effuse/wiki/DX-Gaps-And-Roadmap)

The wiki follows the implementation on `dev` and distinguishes current,
experimental, and planned behavior. Public entry points and executable tests
remain the final authority when older package documentation disagrees.

## Contributing

Open an [issue](https://github.com/chrismichaelps/effuse/issues) before broad
framework changes. Feature work is developed on a focused branch and proposed
to `dev`; `main` is reserved for release promotion. Keep behavior changes close
to focused regression tests and document public contract changes in the same
delivery loop.

Effuse is available under the [MIT License](LICENSE).

Copyright (c) 2025-2026 [Chris M. Perez](https://github.com/chrismichaelps).
