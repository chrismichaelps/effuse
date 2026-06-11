<p align="center">
  <img src="public/banner/banner_readme.svg" alt="Effuse Banner" width="100%" />
</p>

<p align="center">
  A reactive application framework with typed layers, fine-grained UI updates, and layer-owned server APIs.
</p>

Effuse is a modern TypeScript framework for building web applications around explicit capabilities. It prioritizes fine-grained reactivity with **Signals**, component logic that stays close to UI through `define({ script, template })`, and a layer system that owns services, app state, lifecycle, and server routes/actions in one typed place.

The reason to use Effuse is not to get another component API. It is to make app capabilities first-class: auth, data, analytics, routing, feature flags, and server endpoints can be declared as layers, imported into components with local aliases, and tested through one coherent contract.

> **Alert:** Effuse is currently in development and is not ready for production use.

> **Note:** Effuse is experimental, but its direction is intentionally ambitious: a smaller frontend surface with framework-level power from React, Vue, Solid, and Next-like server APIs.

## Why Effuse

```tsx
const ProfileButton = define({
  layers: { auth: AuthLayer } as const,
  script({ layers: { auth } }) {
    const user = auth.services.auth.currentUser();
    return { user };
  },
  template: ({ user }) => <button>{user.name}</button>,
});
```

- **Typed layers** keep app capabilities explicit instead of scattering hidden imports and context.
- **Fine-grained signals** update only dependent UI instead of rerendering a component tree by default.
- **Local layer aliases** make component scripts readable without coupling them to global layer names.
- **Layer-owned APIs/actions** bring Next-like server power to the capability that owns the data, with typed clients, manifests, validation, typed failures, middleware, and cache/runtime metadata.

Read the framework rationale in [Why Effuse](docs/why-effuse.md).

## Development

Effuse requires Node `>=22.14.0` and pnpm `10.32.1`. Run `nvm use` from the
repo root before running the test suite; `.nvmrc` and `.node-version` both pin
the expected local runtime.

## Packages

- **@effuse/core**: The core reactivity engine (Signals) and DOM rendering system.
- **@effuse/router**: A simple, type-safe router for SPA navigation.
- **@effuse/store**: A functional, Effect-based state management library.
- **@effuse/ink**: A reactive Markdown renderer with component embedding support.
- **@effuse/query**: A reactive data fetching library with built-in reliability.
- **@effuse/i18n**: A reactive internationalization library.
- **@effuse/compiler**: An optimized JSX/TSX transformer that automatically handles reactive signal access, reducing boilerplate without impacting performance.
- **@effuse/use**: A collection of hooks for common use cases.

---

### **:busts_in_silhouette: Credits**

- [Chris Michael](https://github.com/chrismichaelps) (Project Leader, and Developer)

---

### **:anger: Troubleshootings**

This is just a personal project created for study / demonstration purpose and to simplify my working life, it may or may
not be a good fit for your project(s).

---

### **:heart: Show your support**

Please :star: this repository if you like it or this project helped you!\
Feel free to open issues or submit pull-requests to help me improving my work.

---

### **:robot: Author**

_*Chris M. Perez*_

> You can follow me on
> [github](https://github.com/chrismichaelps)&nbsp;&middot;&nbsp;[twitter](https://twitter.com/Chris5855M)

---

Copyright ©2025 [Effuse](https://github.com/chrismichaelps/effuse).
