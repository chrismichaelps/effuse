import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/__tests__/**/*.test.ts'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.test.ts',
				'src/index.ts',
				'src/server/index.ts',
				'src/client/index.ts',
				'src/testing/index.ts',
				'src/conformance.ts',
			],
		},
	},
});
