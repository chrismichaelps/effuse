import { readFile } from 'node:fs/promises';

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

console.log('[public-types] declarations do not expose Effect modules');
