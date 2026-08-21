/**
 * A package that demands node types has to depend on them.
 *
 * `"types": ["node"]` in a tsconfig says the compiler must find
 * `@types/node`. Under this workspace's hoisted layout it will find one at the
 * root whether or not the package asked for it, so the mistake is invisible
 * here and fails on a clean install - which is what CI does and what anyone
 * checking out the repo does.
 */
import { readFileSync, readdirSync } from 'node:fs';

const stripComments = (text) => text.replace(/^\s*\/\/.*$/gmu, '');

const packages = readdirSync(new URL('../packages', import.meta.url));
const wrong = [];

for (const name of packages) {
	const base = new URL(`../packages/${name}/`, import.meta.url);

	let tsconfig;
	let manifest;
	try {
		tsconfig = JSON.parse(stripComments(readFileSync(new URL('tsconfig.json', base), 'utf8')));
		manifest = JSON.parse(readFileSync(new URL('package.json', base), 'utf8'));
	} catch {
		continue;
	}

	const demanded = tsconfig.compilerOptions?.types ?? [];
	const declared = {
		...manifest.dependencies,
		...manifest.devDependencies,
		...manifest.peerDependencies,
	};

	for (const type of demanded) {
		if (declared[`@types/${type}`] === undefined) {
			wrong.push(`${name}: demands "${type}" types without depending on @types/${type}`);
		}
	}
}

if (wrong.length > 0) {
	console.error('[type-declarations] a package demands types it does not depend on:');
	for (const line of wrong) console.error(`  ${line}`);
	process.exit(1);
}

console.log(`[type-declarations] ${String(packages.length)} packages depend on the types they demand`);
