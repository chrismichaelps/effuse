import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		// The Bun conformance file is executed by `bun test`, not vitest.
		include: ['src/__tests__/**/*.test.ts'],
		exclude: ['src/__tests__/bun.test.ts', '**/node_modules/**', '**/dist/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/conformance.ts'],
		},
	},
});
