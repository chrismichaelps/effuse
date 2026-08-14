<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  The official CLI and Bundler for Effuse.
</p>

# `@effuse/cli`

The CLI owns development SSR, production builds, TypeScript checks, deployment
presets, and generated server registries for Effuse applications.

## Install

```bash
pnpm add -D @effuse/cli
```

Node.js 22.14 or newer is required. Run the project-local binary through pnpm so
CI and local development use the same installed version.

## Commands

```bash
pnpm exec effuse dev
pnpm exec effuse build
pnpm exec effuse typecheck
pnpm exec effuse manifest
```

| Command     | Ownership                                                                   |
| ----------- | --------------------------------------------------------------------------- |
| `dev`       | Vite development server, HMR, SSR module loading, and generated registries. |
| `build`     | Client/server production output and runtime preset selection.               |
| `typecheck` | Application TypeScript validation without emitting files.                   |
| `manifest`  | Inspect the server manifest or emit a typed server client module.           |

Production presets are `node`, `bun`, `vercel`, `netlify`, and `cloudflare`.
Use `--client-only` only for applications that intentionally do not ship SSR or
server routes.

```bash
pnpm exec effuse build --preset node
pnpm exec effuse manifest --client-out src/generated/server-client.ts
```

Run `pnpm exec effuse --help` for command-specific options. Invalid ports,
hosts, presets, manifest paths, and generated export names fail before starting
the related service.

## Programmatic Surface

`runCli(args)` embeds command execution. `effuseServerRegistryPlugin()` and the
registry compiler APIs support custom Vite integrations. `DevService`,
`BuildService`, and `ManifestResolver` are exported for tooling that needs the
same validated implementation as the binary.

Application code should consume generated route/action clients rather than
importing CLI services into browser modules.

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

Generated `.effuse` artifacts are build output. Add `.effuse/` to the
application's `.gitignore` and let the plugin regenerate them from the current
route tree.
