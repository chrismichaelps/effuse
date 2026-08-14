<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  The JSX/TSX transform and Vite integration for Effuse applications.
</p>

# `@effuse/compiler`

The compiler transforms reactive signal reads in JSX/TSX while preserving
source maps and normal JavaScript semantics. It can run through the Vite plugin
or as a programmatic synchronous/asynchronous transform.

## Install

```bash
pnpm add -D @effuse/compiler
```

Vite is an optional peer dependency and is required only for the plugin entry.

## Vite

```ts
import { defineConfig } from 'vite';
import { effuse } from '@effuse/compiler/vite';

export default defineConfig({
	plugins: [effuse()],
});
```

The plugin processes configured source extensions, skips excluded paths, and
avoids transformation when a module contains no configured signal accessor.
Development mode enables transform diagnostics unless `debug` is set
explicitly.

```ts
effuse({
	extensions: ['.tsx', '.jsx'],
	exclude: ['node_modules', 'dist'],
	sourceMaps: true,
	enableCache: true,
});
```

## Programmatic Transform

```ts
import { defaultConfig, transformSync } from '@effuse/compiler';

const result = transformSync(source, '/src/Counter.tsx', defaultConfig);

if (result.transformed) {
	console.log(result.code, result.map, result.stats);
}
```

`transformAsync` exposes the same result contract for asynchronous pipelines.
`mergeConfig` combines partial options with the documented `defaultConfig`.

## Public Surface

| API                                | Purpose                                                              |
| ---------------------------------- | -------------------------------------------------------------------- |
| `transformSync`, `transformAsync`  | Transform source and return code, map, cache state, and statistics.  |
| `defaultConfig`, `mergeConfig`     | Build a complete compiler configuration.                             |
| `SourceCache`, `createContentHash` | Reuse transforms in custom build integrations.                       |
| `isCompilerError`, `formatError`   | Normalize parser, transform, generation, config, and cache failures. |
| `@effuse/compiler/vite`            | Vite plugin with include/exclude and cache ownership.                |

Compiler errors retain the source filename and structured error category. Build
integrations should report `formatError(error)` and fail the build instead of
publishing partially transformed output.

## Compatibility

- Node.js 22.14 or newer is the supported tooling runtime.
- The Vite plugin supports Vite 5 through 8.
- The package emits ESM and type declarations; it is build tooling, not a
  browser runtime dependency.
