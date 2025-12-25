import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			'@effuse/core/jsx-runtime': path.resolve(
				__dirname,
				'../packages/core/src/jsx-runtime.ts'
			),
			'@effuse/core/jsx-dev-runtime': path.resolve(
				__dirname,
				'../packages/core/src/jsx-runtime.ts'
			),
			'@effuse/core': path.resolve(__dirname, '../packages/core/src/index.ts'),
			'@effuse/router': path.resolve(
				__dirname,
				'../packages/router/src/index.ts'
			),
			'@effuse/store': path.resolve(
				__dirname,
				'../packages/store/src/index.ts'
			),
			'@effuse/query': path.resolve(
				__dirname,
				'../packages/query/src/index.ts'
			),
			'@effuse/ink': path.resolve(__dirname, '../packages/ink/src/index.ts'),
			'@effuse/i18n': path.resolve(__dirname, '../packages/i18n/src/index.ts'),
		},
		dedupe: [
			'@effuse/core',
			'@effuse/store',
			'@effuse/router',
			'@effuse/query',
			'@effuse/i18n',
		],
	},
});
