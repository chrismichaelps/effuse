import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../dist');
const entries = new Map([
	['server.js', "export * from './index.js';\n"],
	['server.cjs', "module.exports = require('./index.cjs');\n"],
	['server.d.ts', "export * from './index.js';\n"],
	['server.d.cts', "export * from './index.cjs';\n"],
]);

await Promise.all(
	[...entries].map(([name, source]) =>
		writeFile(resolve(dist, name), source, 'utf8')
	)
);

console.log('[package-entry] server entry delegates to the canonical runtime');
