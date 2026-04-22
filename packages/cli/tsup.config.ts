import { defineConfig } from 'tsup';

export default defineConfig([
	{
		entry: ['src/index.ts', 'src/cli.ts'],
		format: ['esm', 'cjs'],
		dts: { entry: ['src/index.ts'] },
		sourcemap: true,
		clean: true,
		external: ['vite', 'express', 'cac', 'open'],
	},
	{
		entry: ['src/bin.ts'],
		format: ['cjs'],
		sourcemap: true,
		external: ['vite', 'express', 'cac', 'open'],
	},
]);