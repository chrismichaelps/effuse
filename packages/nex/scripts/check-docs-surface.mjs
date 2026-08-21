/**
 * Every public export has to be findable in the README.
 *
 * Documentation drifts silently: an export lands, the prose that was meant to
 * describe it does not, and nothing says so. This is the only check that
 * notices, because it reads what is actually published rather than what
 * anyone remembers writing.
 *
 * An export that genuinely belongs to another entry's story - the safe twin
 * of a throwing function, say - is listed below with the reason, so muting
 * one is a decision someone wrote down rather than a name quietly dropped.
 */
import { readFileSync } from 'node:fs';
import * as nex from '../dist/index.js';

const COVERED_ELSEWHERE = {
	buildCatalogFromIntrospectionSafe:
		'the safe twin of buildCatalogFromIntrospection, which the README shows',
};

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

const missing = Object.keys(nex)
	.filter((name) => name !== 'default')
	// Whole names only: `nexQueryKey` in the prose does not document
	// `nexQuery`, and a substring match would say it did.
	.filter((name) => !new RegExp(`\\b${name}\\b`, 'u').test(readme))
	.filter((name) => COVERED_ELSEWHERE[name] === undefined);

if (missing.length > 0) {
	console.error(
		`[docs-surface] ${String(missing.length)} public exports are not in the README:`
	);
	for (const name of missing) console.error(`  ${name}`);
	console.error(
		'\nDocument them, or add them to COVERED_ELSEWHERE with the reason.'
	);
	process.exit(1);
}

const counted = Object.keys(nex).length - 1;
console.log(`[docs-surface] all ${String(counted)} public exports are in the README`);
