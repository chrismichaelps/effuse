import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const browserEntry = resolve(root, 'dist/client.js');
const source = await readFile(browserEntry, 'utf8');

const forbidden = [
	{
		pattern: /\bnode:async_hooks\b|\basync_hooks\b/,
		reason: 'browser entry must not require AsyncLocalStorage polyfills',
	},
	{
		pattern: /\bnode:crypto\b|from ['"]crypto['"]|from "crypto"/,
		reason: 'browser entry must not include Node crypto',
	},
	{
		pattern: /\bcreateServerApp\b|\bcreateHandler\b|\bcreateStreamingHandler\b|\brenderToString\b|\bfromServerFiles\b/,
		reason: 'browser entry must not bundle server-only SSR APIs',
	},
];

const failures = forbidden.filter(({ pattern }) => pattern.test(source));

if (failures.length > 0) {
	for (const failure of failures) {
		console.error(`[browser-entry] ${failure.reason}`);
	}
	process.exit(1);
}

console.log('[browser-entry] dist/client.js is browser safe');
