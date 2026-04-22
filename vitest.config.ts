import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		exclude: ['**/*.test.mjs', '**/node_modules/**', '**/dist/**'],
	},
});
