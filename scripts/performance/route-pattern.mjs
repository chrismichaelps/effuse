import { readFile } from 'node:fs/promises';
import {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
	parseRoutePattern,
	resolveRoutePattern,
} from '../../packages/core/dist/client.js';
import {
	compileLayerServerRouter,
	compileServerFileRegistry,
	defineLayer,
	matchLayerServerRequest,
	matchServerFileRequest,
} from '../../packages/core/dist/server.js';
import {
	evaluateBudgets,
	formatResults,
	runBenchmark,
	runtimeMetadata,
} from './benchmark.mjs';

const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const options = quick
	? { warmup: 2, samples: 8, iterations: 1_000 }
	: { warmup: 5, samples: 30, iterations: 10_000 };
const compiledDynamic = compileRoutePattern('/users/[id]/files/[...path]');
const routeTable = Array.from({ length: 48 }, (_, index) =>
	compileRoutePattern(`/catalog/category-${index}/[id]`)
);
routeTable.push(compileRoutePattern('/catalog/[section]/[id]'));
const serverApi = Object.fromEntries(
	Array.from({ length: 48 }, (_, index) => [
		`/api/catalog/category-${index}/[id]`,
		() => ({ ok: true }),
	])
);
serverApi['/api/catalog/[section]/[id]'] = () => ({ ok: true });
const ServerBenchmarkLayer = defineLayer({
	name: 'server-router-benchmark',
	server: { api: serverApi },
});
const compiledServerRouter = compileLayerServerRouter([ServerBenchmarkLayer]);
const serverRequests = Array.from(
	{ length: 48 },
	(_, index) => new Request(`http://localhost/api/catalog/category-${index}/42`)
);
const lazyServerEntries = Array.from({ length: 48 }, (_, index) => ({
	kind: 'api',
	filePath: `category-${index}.ts`,
	path: `/api/catalog/category-${index}/[id]`,
	load: async () => ({ GET: () => ({ ok: true }) }),
}));
lazyServerEntries.push({
	kind: 'api',
	filePath: 'category.ts',
	path: '/api/catalog/[section]/[id]',
	load: async () => ({ GET: () => ({ ok: true }) }),
});
const compiledFileRegistry = compileServerFileRegistry(lazyServerEntries);

let routeIndex = 0;
const cases = [
	{
		name: 'route.parse',
		operation: () => parseRoutePattern('/(app)/users/[id]/[[...tab]]'),
	},
	{
		name: 'route.compile',
		operation: () => compileRoutePattern('/users/[id]/files/[...path]'),
	},
	{
		name: 'route.match',
		operation: () =>
			matchRoutePattern(compiledDynamic, '/users/42/files/docs/setup'),
	},
	{
		name: 'route.resolve',
		operation: () =>
			resolveRoutePattern('/users/[id]/files/[...path]', {
				id: '42',
				path: 'docs/setup',
			}),
	},
	{
		name: 'route.compare',
		operation: () => compareRoutePatterns('/shop/new', '/shop/[[...slug]]'),
	},
	{
		name: 'route.table-scan',
		iterations: Math.max(100, options.iterations / 10),
		operation: () => {
			const pathname = `/catalog/category-${routeIndex++ % 48}/42`;
			for (const route of routeTable) {
				const match = matchRoutePattern(route, pathname);
				if (match) return match;
			}
			return null;
		},
	},
	{
		name: 'server.router-compile',
		iterations: Math.max(50, options.iterations / 20),
		operation: () => compileLayerServerRouter([ServerBenchmarkLayer]),
	},
	{
		name: 'server.router-match',
		iterations: Math.max(100, options.iterations / 10),
		operation: () =>
			matchLayerServerRequest(
				serverRequests[routeIndex++ % serverRequests.length],
				compiledServerRouter
			),
	},
	{
		name: 'server.files-compile',
		iterations: Math.max(50, options.iterations / 20),
		operation: () => compileServerFileRegistry(lazyServerEntries),
	},
	{
		name: 'server.files-match',
		iterations: Math.max(100, options.iterations / 10),
		operation: () =>
			matchServerFileRequest(
				serverRequests[routeIndex++ % serverRequests.length],
				compiledFileRegistry
			),
	},
];

const results = cases.map((benchmark) =>
	runBenchmark({ ...options, ...benchmark })
);
const report = {
	schemaVersion: 1,
	unit: 'nanosecondsPerOperation',
	configuration: options,
	...runtimeMetadata(),
	results,
};

if (args.has('--json')) console.log(JSON.stringify(report, null, 2));
else formatResults(results);

if (args.has('--check')) {
	const budgetUrl = new URL('./route-pattern-budgets.json', import.meta.url);
	const budgets = JSON.parse(await readFile(budgetUrl, 'utf8'));
	const failures = evaluateBudgets(results, budgets);
	if (failures.length > 0) {
		console.error(`Performance budget failed:\n${failures.join('\n')}`);
		process.exitCode = 1;
	}
}
