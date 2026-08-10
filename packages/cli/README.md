<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  The official CLI and Bundler for Effuse.
</p>

## Generated server registry

`effuseServerRegistryPlugin()` discovers file-derived API routes and actions and
writes `.effuse/server-registry.ts`. Server modules should import that owned
artifact with a runtime `.js` specifier:

```ts
import {
	loadServerFiles,
	matchServerFile,
} from '../../.effuse/server-registry.js';
```

The plugin owns that specifier. It resolves the generated `.js` path, and the
`.ts` source path, to the generated TypeScript module in Vite development SSR,
including `ssrLoadModule()`. Resolution no longer depends on Vite remapping
extensions, so applications need neither `allowImportingTsExtensions` nor
environment-specific paths.

If the `.effuse` artifacts are missing when a request resolves the import — a
fresh checkout, a cleaned output directory, or a dev server started before the
first generation — the plugin regenerates them instead of failing the request
with `Failed to load url ../../.effuse/server-registry.js`. The same rules apply
to `.effuse/server-middleware-registry.ts`.
