import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const cacheExports = ['createResponseCache', 'createDataCache'];
const clientExports = ['useHead'];
const loadEsm = (name) =>
	import(pathToFileURL(resolve(root, `dist/${name}.js`)).href);

const assertRuntimeExports = (entry, label) => {
	for (const name of cacheExports) {
		if (typeof entry[name] !== 'function') {
			throw new Error(`[package-entry] ${label} does not export ${name}`);
		}
	}
};

for (const name of ['index', 'server']) {
	const esm = await loadEsm(name);
	const cjs = require(resolve(root, `dist/${name}.cjs`));
	assertRuntimeExports(esm, `${name} ESM`);
	assertRuntimeExports(cjs, `${name} CJS`);

	for (const extension of ['d.ts', 'd.cts']) {
		const declaration = await readFile(
			resolve(root, `dist/${name}.${extension}`),
			'utf8'
		);
		if (name === 'server') {
			const target = extension === 'd.ts' ? './index.js' : './index.cjs';
			assert.equal(
				declaration,
				`export * from '${target}';\n`,
				`server.${extension} must delegate to ${target}`
			);
			continue;
		}
		for (const exportName of cacheExports) {
			if (!declaration.includes(exportName)) {
				throw new Error(
					`[package-entry] ${name}.${extension} omits ${exportName}`
				);
			}
		}
	}
}

const rootEsm = await loadEsm('index');
const serverEsm = await loadEsm('server');
const clientEsm = await loadEsm('client');
const rootCjs = require(resolve(root, 'dist/index.cjs'));
const serverCjs = require(resolve(root, 'dist/server.cjs'));
const clientCjs = require(resolve(root, 'dist/client.cjs'));

for (const name of clientExports) {
	assert.equal(typeof clientEsm[name], 'function', `client ESM omits ${name}`);
	assert.equal(typeof clientCjs[name], 'function', `client CJS omits ${name}`);
}

for (const name of [
	'define',
	'provide',
	'inject',
	'createSSRRuntime',
	'renderToString',
	'useHead',
]) {
	assert.equal(
		serverEsm[name],
		rootEsm[name],
		`server ESM duplicates the ${name} runtime export`
	);
	assert.equal(
		serverCjs[name],
		rootCjs[name],
		`server CJS duplicates the ${name} runtime export`
	);
}

const contextKey = Symbol('mixed-entry-context');
const Child = rootEsm.define({
	script: ({ inject }) => ({ value: inject(contextKey, 'missing') }),
	template: ({ value }) => value,
});
const Parent = rootEsm.define({
	script: ({ provide }) => {
		provide(contextKey, 'shared');
		return {};
	},
	template: () =>
		rootEsm.CreateBlueprintNode({
			[rootEsm.EFFUSE_NODE]: true,
			blueprint: Child,
			props: {},
			portals: null,
		}),
});
const runtime = await serverEsm.createSSRRuntime([]);
try {
	const result = runtime.run(() =>
		serverEsm.renderToString(Parent, '/', runtime)
	);
	assert.match(
		result.html,
		/shared/,
		'mixed root/server rendering lost the provide scope'
	);
} finally {
	await runtime.dispose();
}

for (const extension of ['js', 'cjs', 'd.ts', 'd.cts']) {
	const browser = await readFile(
		resolve(root, `dist/client.${extension}`),
		'utf8'
	);
	for (const name of clientExports) {
		assert.match(browser, new RegExp(`\\b${name}\\b`));
	}
	for (const name of cacheExports) {
		if (browser.includes(name)) {
			throw new Error(
				`[package-entry] client.${extension} exposes server cache API ${name}`
			);
		}
	}
}

console.log(
	'[package-entry] root/server identity, context, cache, and browser contracts match'
);
