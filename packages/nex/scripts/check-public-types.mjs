#!/usr/bin/env node
/**
 * Guard the public contract: `@effuse/nex` is built on Effect internally, but
 * consumers must never need to know that. Fail the build if the generated
 * declarations reference the Effect ecosystem.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const declarations = ['dist/index.d.ts', 'dist/index.d.cts'];
const forbidden = [
	/from ['"]effect['"]/,
	/\bSchema\./,
	/\bEffect\./,
	/\bLayer\./,
];

let failed = false;

for (const file of declarations) {
	const source = readFileSync(resolve(packageRoot, file), 'utf8');
	for (const pattern of forbidden) {
		const match = pattern.exec(source);
		if (match === null) continue;
		const line = source.slice(0, match.index).split('\n').length;
		console.error(
			`[public-types] ${file}:${line} leaks Effect into the public API: ${match[0]}`
		);
		failed = true;
	}
}

if (failed) {
	process.exit(1);
}

console.log(
	`[public-types] ${declarations.length} declaration files are Effect-free`
);
