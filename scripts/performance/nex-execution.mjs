#!/usr/bin/env node
/**
 * What running a Nex request costs.
 *
 * The shapes here are the ones that decide whether a server holds up: a large
 * list, the same list paged, and a request that resolves nothing but scalars.
 * A list is where the work multiplies, so that is where a regression shows
 * first.
 */
import { readFile } from 'node:fs/promises';
import {
	evaluateBudgets,
	formatResults,
	runAsyncBenchmark,
	runtimeMetadata,
} from './benchmark.mjs';

const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const options = quick
	? { warmup: 1, samples: 4, iterations: 2 }
	: { warmup: 2, samples: 10, iterations: 5 };

const { buildCatalog, execute } = await import(
	new URL('../../packages/nex/dist/index.js', import.meta.url).href
);

const catalog = buildCatalog(`
	type Query { posts: [Post!]! @connection scalar: String! }
	type Post { id: ID! title: String! rank: Int! author: User! }
	type User { id: ID! name: String! }
`);

const ROWS = 2000;
const rows = Array.from({ length: ROWS }, (_, index) => ({
	id: String(index),
	title: `post ${index}`,
	rank: index,
	author: { id: 'u', name: 'Ada' },
}));

const resolvers = {
	Query: { posts: () => rows, scalar: () => 'value' },
};

const run = (request) => async () => {
	const result = await execute({ request, catalog, resolvers });
	if (result.errors !== undefined) {
		throw new Error(`benchmark request failed: ${result.errors[0]?.message}`);
	}
};

const results = [
	await runAsyncBenchmark({
		name: 'nex.scalar-field',
		operation: run('{ scalar }'),
		...options,
	}),
	await runAsyncBenchmark({
		name: 'nex.large-list',
		operation: run('{ posts { id title rank author { id name } } }'),
		...options,
	}),
	await runAsyncBenchmark({
		name: 'nex.paged-list',
		operation: run('{ posts | sort rank desc | page first: 25 { id title } }'),
		...options,
	}),
];

const metadata = runtimeMetadata();
console.table([metadata]);
console.table(formatResults(results));

if (args.has('--check')) {
	const budgets = JSON.parse(
		await readFile(
			new URL('./nex-execution-budgets.json', import.meta.url),
			'utf8'
		)
	);
	const failures = evaluateBudgets(results, budgets.warm);

	if (failures.length > 0) {
		console.error(`[nex-execution] ${String(failures.length)} budget failures`);
		for (const failure of failures) console.error(`  ${failure}`);
		process.exit(1);
	}

	console.log(
		`[nex-execution] ${String(results.length)} benchmarks within budget`
	);
}
