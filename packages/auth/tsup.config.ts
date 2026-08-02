import { defineConfig } from 'tsup';

export default defineConfig({
	entry: [
		'src/index.ts',
		'src/server/index.ts',
		'src/client/index.ts',
		'src/testing/index.ts',
		'src/conformance.ts',
	],
	format: ['cjs', 'esm'],
	dts: true,
	sourcemap: true,
	clean: true,
	treeshake: true,
	splitting: false,
});
