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

const { buildCatalog, createLoader, execute } = await import(
	new URL('../../packages/nex/dist/index.js', import.meta.url).href
);

const catalog = buildCatalog(`
	directive @noop on FIELD_DEFINITION
	type Query { posts: [Post!]! @connection scalar: String! wrapped: String! @noop }
	type Post { id: ID! title: String! rank: Int! author: User! loaded: User! }
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
	Query: { posts: () => rows, scalar: () => 'value', wrapped: () => 'value' },
	Post: {
		// Every row asks for the same handful of authors, which is the shape a
		// loader exists for: what it costs is what gathering costs.
		loaded: (source, _args, context) => context.authors.load(source.author.id),
		// A relation that has to be waited on, which is what makes a list of
		// rows expensive in the shape a server actually serves.
		author: async (source) => {
			await Promise.resolve();
			return source.author;
		},
	},
};

/** A directive that changes nothing, so what it measures is the wrapping. */
const directives = { noop: { onField: (next) => next() } };

const run = (request, extra = {}) => async () => {
	const result = await execute({ request, catalog, resolvers, ...extra });
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
		name: 'nex.list-of-relations',
		operation: run('{ posts { id author { name } } }'),
		...options,
	}),
	await runAsyncBenchmark({
		name: 'nex.paged-list',
		operation: run('{ posts | sort rank desc | page first: 25 { id title } }'),
		...options,
	}),
	await runAsyncBenchmark({
		name: 'nex.loaded-list',
		operation: run('{ posts { loaded { name } } }', {
			// One loader per run, the way a server builds one per request.
			context: {
				authors: createLoader({
					load: (ids) => Promise.resolve(ids.map((id) => ({ id, name: 'Ada' }))),
				}),
			},
		}),
		...options,
	}),
	await runAsyncBenchmark({
		name: 'nex.directive-wrapped',
		operation: run('{ wrapped }', { directives }),
		...options,
	}),
	await runAsyncBenchmark({
		name: 'nex.directive-absent',
		operation: run('{ scalar }', { directives }),
		...options,
	}),
];

const metadata = runtimeMetadata();
console.table([metadata]);
formatResults(results);

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
