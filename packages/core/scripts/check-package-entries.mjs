import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const cacheExports = ['createResponseCache', 'createDataCache'];

const assertRuntimeExports = (entry, label) => {
	for (const name of cacheExports) {
		if (typeof entry[name] !== 'function') {
			throw new Error(`[package-entry] ${label} does not export ${name}`);
		}
	}
};

for (const name of ['index', 'server']) {
	const esm = await import(pathToFileURL(resolve(root, `dist/${name}.js`)).href);
	const cjs = require(resolve(root, `dist/${name}.cjs`));
	assertRuntimeExports(esm, `${name} ESM`);
	assertRuntimeExports(cjs, `${name} CJS`);

	for (const extension of ['d.ts', 'd.cts']) {
		const declaration = await readFile(
			resolve(root, `dist/${name}.${extension}`),
			'utf8'
		);
		for (const exportName of cacheExports) {
			if (!declaration.includes(exportName)) {
				throw new Error(
					`[package-entry] ${name}.${extension} omits ${exportName}`
				);
			}
		}
	}
}

for (const extension of ['js', 'cjs', 'd.ts', 'd.cts']) {
	const browser = await readFile(resolve(root, `dist/client.${extension}`), 'utf8');
	for (const name of cacheExports) {
		if (browser.includes(name)) {
			throw new Error(
				`[package-entry] client.${extension} exposes server cache API ${name}`
			);
		}
	}
}

console.log('[package-entry] cache exports match root/server/browser contracts');
