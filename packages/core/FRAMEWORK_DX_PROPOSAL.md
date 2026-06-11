# Effuse Framework DX Proposal

This proposal is based on the published docs at
`chrismichaelps/effuse-doc/src/content/docs/en` and the current `@effuse/core`
API. The main issue is not feature count. The issue is that docs and core APIs
teach different mental models for layers, hooks, component scripts, and server
capabilities.

## Product Thesis

Effuse should be the framework for teams that want app capabilities to be
explicit and typed from the root to the component.

- A layer owns a capability such as auth, theme, data, analytics, routing, or
  feature flags.
- A component imports that capability with a local alias instead of string
  lookups.
- Hooks use the same alias model as components.
- Server APIs and actions live on the layer that owns the data.
- Fine-grained signals update the UI without a virtual DOM rerender loop.

Effuse should feel smaller than React, more explicit than Vue plugin globals,
more application-oriented than Solid primitives alone, and more
capability-owned than Next route files scattered away from business services.

## Published Docs Gaps

### Layers

The published layer docs describe `store`, `deriveProps`, and `provides`, then
show components using `useLayerProps('theme')`, `useStore('theme')`, hook
`deps`, and `layer('theme')`. That makes the layer system feel string-driven and
registry-heavy.

Production direction:

```tsx
const ThemeToggle = define({
  layers: { theme: ThemeLayer } as const,
  script({ layers: { theme } }) {
    const mode = theme.props.mode;
    const themeStore = theme.services.theme;
    return {
      label: computed(() => (mode.value === 'dark' ? 'Light' : 'Dark')),
      toggle: () => themeStore.toggleMode(),
    };
  },
  template: ({ label, toggle }) => <button onClick={toggle}>{label}</button>,
});
```

### Script Context

The published docs list both `effect` and `watchEffect` across different pages,
plus `useLayer`, `useLayerProps`, `useService`, and `useStore` as separate
concepts. Core should teach one primary layer path:

- `layers` as the preferred capability import surface.
- `useLayer(layer)` and `useService(layer, key)` as direct escape hatches.
- string-based `useService(key)` only as compatibility.
- `watchEffect` as the documented side-effect primitive unless `effect` is
  intentionally exposed.

### Hooks

The published hooks docs show `deps`, `layer`, `layerProvider`, and `effect`.
Core hooks should use the same layer grammar as components.

```ts
export const useTheme = defineHook({
  layers: { theme: ThemeLayer } as const,
  setup({ layers: { theme } }) {
    return {
      mode: theme.props.mode,
      toggle: () => theme.services.theme.toggleMode(),
    };
  },
});
```

### Template Shape

The published quick-start page shows `template: ({ count }, props) => ...`.
Current `define` passes a single merged context containing exposed values,
props, and children. Docs should teach the runtime shape until core formally
supports a second template argument.

### Server APIs

The published routing docs cover SPA routing but not server APIs. Effuse should
make layer-owned server APIs the framework answer to Next-style API routes.

```ts
export const UserLayer = defineLayer({
  name: 'user',
  services: {
    users: () => ({
      findById: (id: string) => ({ id, name: 'Chris' }),
    }),
  },
  server: {
    api: {
      '/api/users/:id': ({ params, services }) =>
        services.users.findById(params.id),
    },
    actions: {
      refreshUser: ({ services }) => services.users.findById('u1'),
    },
  },
});
```

### File-System APIs

Next succeeds here because a route file is easy to find and easy to deploy.
Effuse should support that adoption path, but the file system should feed the
same layer server model instead of becoming a second server framework.

Recommended convention:

```txt
src/server/api/users/[id].ts
src/server/actions/users/refresh.ts
```

Those files should compile to a server manifest entry that can be attached to a
layer:

```ts
export const UsersLayer = defineLayer({
  name: 'users',
  services: { users: () => usersService },
  server: fromFiles(import.meta.glob('../server/api/users/**')),
});
```

The production rule: file routes are for discoverability and migration; layer
server config is the canonical capability graph. Generated manifests must point
back to owning layers so actions, routes, services, middleware, caching, and
docs stay synchronized.

## Proposal

### External Inspiration Check

Reviewed during this PR:

- Next.js Route Segment Config:
  https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
- Next.js Proxy middleware model:
  https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Nuxt route rules:
  https://nuxt.com/docs/api/nuxt-config#routerules
- SvelteKit server hooks:
  https://svelte.dev/docs/kit/hooks
- Remix loaders and thrown/returned responses:
  https://v2.remix.run/docs/route/loader/

Useful ideas to absorb:

- Next validates route config as static exports and makes deployment hints like
  runtime, region, and max duration visible to the framework.
- Next Proxy and SvelteKit `handle` prove that request interception must be able
  to short-circuit, mutate headers, and continue to the route.
- Nuxt route rules prove cache/proxy/header policy needs to be adapter-visible.
- Remix proves server handlers should return ordinary Fetch `Response` objects
  and let typed data/errors flow back to UI code.

Effuse should not copy the folder/global-first model. The Effuse version is a
capability graph: middleware, validation, runtime hints, cache policy, CORS, and
typed failures attach to the owning layer and then flow into the manifest for
adapters.

1. Make alias records the primary layer DX:

```ts
layers: { auth: AuthLayer, db: DatabaseLayer } as const
```

Arrays can remain for compatibility, but docs should prefer aliases so
components do not depend on global layer names like `platformAuth`.

2. Treat `services` as the preferred name.

Keep `provides` as a compatibility alias. Teach `services` everywhere because
it matches `ctx.services`, component access, and app capability language.

3. Sync server handlers with layer services.

`server.api` and `server.actions` should infer `ctx.services` from the same
`services` object in `defineLayer`. Casts inside handlers are a DX failure.

4. Put Next-like power behind layers.

Layer server APIs should provide `server.api`, `server.actions`, dynamic params,
typed `query`, typed body helpers, response helpers, generated server entry
support, and SSR fallback after API/action matching.

The core package now also provides client helpers for this surface:

```ts
const result = await callLayerAction(UserLayer, 'refreshUser', {
  id: 'u1',
});

const users = createLayerActionClient(UserLayer);
await users.refreshUser({ id: 'u1' });
```

Layer-scoped action URLs use `/_effuse/actions/<layer>/<action>` to avoid
collisions, while the legacy `/_effuse/actions/<action>` path remains supported.

`createLayerServerManifest()` exposes layer API routes, server routes, and
actions as a stable manifest for adapters, devtools, and generated clients.
`createLayerServerManifestClient()` consumes that manifest at runtime, while
`generateLayerServerClientModule()` emits a typed module for generated imports.

```ts
const manifest = createLayerServerManifest([UserLayer]);
const client = createLayerServerManifestClient(manifest);

await client.route('/api/users/[id]', { params: { id: 'u1' } });
await client.action('user', 'refreshUser', { id: 'u1' });
```

Server handlers now receive `ctx.validate`, a schema-library-friendly request
validation helper that keeps params, query, headers, JSON, and form data on the
same layer context:

```ts
server: {
  api: {
    '/api/users/[id]': ({ validate, services }) => {
      const params = validate.params<{ id: string }>(UserParams);
      const query = validate.query<{ tab: string }>(UserQuery);
      return services.users.findById(params.id, query.tab);
    },
  },
  actions: {
    saveUser: async ({ validate, services }) => {
      const body = await validate.json<{ name: string }>(SaveUserBody);
      return services.users.save(body);
    },
  },
}
```

Validation failures return a stable `400` response with
`EFFUSE_VALIDATION_FAILED`, `source`, and `issues`. That gives adapters and
client helpers one error shape.

Domain/API errors use the same server-owned contract:

```ts
server: {
  api: {
    '/api/users/[id]': ({ params }) => {
      throw new LayerServerError('USER_NOT_FOUND', 'User not found.', {
        status: 404,
        details: { id: params.id },
      });
    },
  },
  actions: {
    saveUser: ({ response }) =>
      response.error('SAVE_DENIED', 'Save denied.', {
        status: 409,
        details: { field: 'email' },
      }),
  },
}
```

Action clients keep the raw error body and parse typed JSON into
`LayerActionError<T>`, so UI code can narrow on `error.data.error.code` without
manually parsing response text.

Server policy now attaches to the same graph:

```ts
server: {
  middleware: [requireSession],
  metadata: {
    runtime: 'edge',
    cache: { tags: ['users'], revalidate: 60 },
  },
  api: {
    '/api/users/[id]': {
      GET: getUser,
      middleware: [allowTeamMember],
      metadata: {
        region: ['iad1', 'sfo1'],
        maxDuration: 5,
      },
    },
  },
}
```

Layer middleware composes through dependencies before the owning layer and then
route/action middleware. Metadata flows into responses and manifests, and
conflicting route/action metadata records manifest diagnostics instead of
silently hiding the override.

File-system API folders should be an optional manifest source:

- `src/server/api/**/route.ts` or `src/server/api/**/*.ts` for request handlers.
- `src/server/actions/**/*.ts` for action handlers.
- generated route entries attach to an owning layer by folder metadata or
  explicit export.
- conflicts between file routes and layer routes should be diagnostics, not
  silent last-write-wins behavior.

Next roadmap:

- CLI generation and watch mode around `generateLayerServerClientModule()`.
- richer adapter use of layer and route/action middleware.
- generated deployment config from cache/revalidate/runtime metadata.
- streaming responses and event streams.
- error boundaries for server handlers.
- file upload helpers around `formData`.

5. Use one hook/component mental model.

Components and hooks should both use `layers: { alias: Layer } as const`, and
both should receive `ctx.layers.alias.props` plus
`ctx.layers.alias.services`.

6. Update the published docs repo after this core PR lands.

The docs repo should replace `useLayerProps`, hook `deps`/`layer`, and primary
`provides` examples with the alias-record/service/server contract. It should
also add a server APIs page and fix quick-start template examples.

## Production Ecosystem Gaps

These are the next gaps that matter for production users:

- **Routing manifest/typegen**: generate typed API/action clients from
  `createLayerServerManifest()` and fail builds on duplicate routes, ambiguous
  params, or invalid methods.
- **File-system server adapter**: support `src/server/api` and
  `src/server/actions` as an optional convention that maps into layer-owned
  routes/actions.
- **Validation and typed failure**: request schema validation,
  `EFFUSE_VALIDATION_FAILED`, `LayerServerError`, `ctx.response.error`, and
  typed `LayerActionError<T>` parsing now exist in core. The next layer is
  docs/examples and richer generated-client error unions.
- **Middleware and cache metadata**: layer-level and route/action middleware,
  auth guards, cache tags, revalidation, runtime/region hints, CORS, response
  headers, manifest metadata, and conflict diagnostics now exist in core. The
  next layer is adapter deployment output and docs examples.
- **Observability**: first-class tracing hooks for route/action duration,
  status, service usage, and errors.
- **CLI/dev server**: a Bun/pnpm-first dev command that builds manifests,
  watches files, shows route collisions, and previews server endpoints.
- **Docs and examples**: replace string layer docs with alias-record docs and
  add complete examples for auth, forms, API routes, actions, redirects, and
  uploads.
- **Compatibility story**: document which APIs are stable, experimental, or
  adapter-only so users can upgrade without guessing.

## Senior Grill

- If server handlers need service casts, the server API is not production-ready.
- If components must know global layer names, aliases are missing.
- If hooks use different layer syntax than components, the framework is
  teaching two mental models.
- If docs still teach `useLayerProps` while core teaches `layers`, users will
  assume the framework is unstable.
- If API routes are separate from layers, Effuse becomes another routing system
  instead of a capability-oriented framework.

## Handoff

This core PR lands the runtime and type foundation:

- `define` and `defineHook` accept alias record layers.
- layer accessors preserve alias keys while resolving through real layer names.
- app and server layer inputs accept alias records.
- `defineLayer` server handlers infer services from the layer service contract.
- layer actions have scoped URLs and client helpers via `callLayerAction` and
  `createLayerActionClient`.
- layer server manifests expose routes/actions for future adapters and generated
  clients.
- server handlers receive `ctx.validate` for params, query, headers, JSON, and
  form data, with structured validation responses.
- server handlers can return or throw typed domain errors with
  `ctx.response.error` and `LayerServerError`, and action clients parse those
  bodies through `LayerActionError<T>`.
- server routes/actions support layer and handler middleware plus cache, CORS,
  runtime, region, and max-duration metadata exposed through responses and the
  server manifest.
- README explains why Effuse should exist as a framework.

The docs repo should then receive a focused follow-up PR around this contract.
