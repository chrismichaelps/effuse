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

## Proposal

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

Next roadmap:

- generated client action modules for build-time route manifests.
- middleware per layer and per route.
- route-level cache/revalidate metadata.
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
- README explains why Effuse should exist as a framework.

The docs repo should then receive a focused follow-up PR around this contract.
