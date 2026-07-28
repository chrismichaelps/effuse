import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const declarationFiles = ['dist/index.d.ts', 'dist/index.d.cts'];
const effectImport = /(?:from\s+|import\()['"]effect(?:\/[^'"]*)?['"]/u;

for (const file of declarationFiles) {
	const declaration = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
	if (effectImport.test(declaration)) {
		throw new Error(
			`[public-types] ${file} exposes Effect types. Keep Effect behind Effuse-owned contracts.`
		);
	}
}

const requiredHooks = [
	'useWindowSize',
	'useLocalStorage',
	'useEventListener',
	'useMediaQuery',
	'useOnline',
	'useInterval',
	'useTimeout',
	'useDocumentVisibility',
	'useClipboard',
	'usePreferredColorScheme',
	'useAsyncTask',
	'useDebounce',
	'useThrottle',
];
const esm = await import(new URL('../dist/index.js', import.meta.url));
const require = createRequire(import.meta.url);
const cjs = require('../dist/index.cjs');

for (const hook of requiredHooks) {
	if (typeof esm[hook] !== 'function' || typeof cjs[hook] !== 'function') {
		throw new Error(
			`[public-entry] ${hook} must be callable from ESM and CommonJS.`
		);
	}
}

console.log('[public-types] declarations do not expose Effect modules');
console.log('[public-entry] ESM and CommonJS load without browser globals');
