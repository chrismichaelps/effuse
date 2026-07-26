import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts', 'src/node/index.ts', 'src/bun/index.ts'],
	format: ['cjs', 'esm'],
	dts: true,
	sourcemap: true,
	clean: true,
	treeshake: true,
	splitting: false,
});
