import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const entries = [
	'packages/compiler/dist/index.js',
	'packages/core/dist/index.js',
	'packages/core/dist/server.js',
	'packages/i18n/dist/index.js',
	'packages/ink/dist/index.js',
	'packages/nex/dist/index.js',
	'packages/query/dist/index.js',
	'packages/router/dist/index.js',
	'packages/server/dist/index.js',
	'packages/server/dist/node/index.js',
	'packages/store/dist/index.js',
	'packages/use/dist/index.js',
];

const loaded = new Map();
for (const entry of entries) {
	const absolutePath = path.join(root, entry);
	await access(absolutePath);
	loaded.set(entry, await import(pathToFileURL(absolutePath).href));
}

const router = loaded.get('packages/router/dist/index.js');
if (typeof router?.createMemoryHistory !== 'function') {
	throw new Error(
		'@effuse/router must export createMemoryHistory for server-side routing.'
	);
}

const memoryHistory = router.createMemoryHistory('/ssr-entry-check');
if (memoryHistory.getCurrentPath() !== '/ssr-entry-check') {
	throw new Error('createMemoryHistory failed its server-side entry check.');
}

const webHistory = router.createWebHistory();
if (webHistory.getCurrentPath() !== '/') {
	throw new Error(
		'createWebHistory must use its server-side fallback without window.'
	);
}

console.log(
	`[ssr-entry] ${entries.length} public entries are Node import-safe`
);
