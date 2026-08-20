import { readFile } from 'node:fs/promises';
import {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
	parseRoutePattern,
	resolveRoutePattern,
	createRouteTrie,
	matchRouteTrie,
} from '../../packages/core/dist/client.js';
import {
	compileLayerServerRouter,
	compileServerFileRegistry,
	createSSRRuntime,
	defineLayer,
	matchLayerServerRequest,
	matchServerFileRequest,
	renderToFragment,
	defineServerMiddleware,
	compileServerMiddlewareGraph,
	selectServerMiddlewareChain,
} from '../../packages/core/dist/server.js';
import {
	CreateElementNode,
	CreateTextNode,
	EFFUSE_NODE,
} from '../../packages/core/dist/client.js';
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
// Same table as route.table-scan, indexed as a prefix tree so the two can be
// compared directly at equal route counts.
const routeTrie = createRouteTrie(
	routeTable.map((pattern) => ({ pattern: pattern.pattern, value: pattern }))
);
// A larger table exposes the asymptotic difference: the linear scan grows with
// route count while the trie stays flat in the path's segment depth.
const largeRoutePaths = Array.from(
	{ length: 500 },
	(_, index) => `/catalog/category-${index}/[id]`
);
const largeRouteTable = largeRoutePaths.map((path) =>
	compileRoutePattern(path)
);
const largeRouteTrie = createRouteTrie(
	largeRoutePaths.map((path) => ({ pattern: path, value: path }))
);

// A representative document render: escaping and string assembly dominate SSR
// cost, so this guards the whole markup path rather than one helper.
const ssrText = (value) => CreateTextNode({ [EFFUSE_NODE]: true, text: value });
const ssrElement = (tag, props, children) =>
	CreateElementNode({ [EFFUSE_NODE]: true, tag, props, children });
const ssrRows = Array.from({ length: 200 }, (_, index) =>
	ssrElement('tr', { class: 'row', 'data-id': String(index) }, [
		ssrElement('td', { class: 'cell name' }, [
			ssrText(`Product number ${index}`),
		]),
		ssrElement('td', { class: 'cell desc' }, [
			ssrText('A high quality item for everyday use'),
		]),
		ssrElement('td', { class: 'cell price' }, [ssrText(`$${index}.99`)]),
		ssrElement('td', { class: 'cell' }, [
			ssrElement('a', { href: `/products/${index}`, title: 'View details' }, [
				ssrText('View'),
			]),
		]),
	])
);
const ssrTree = ssrElement('table', { class: 'catalog' }, [
	ssrElement('tbody', {}, ssrRows),
]);
const ssrRuntime = await createSSRRuntime([]);

// Middleware graph: compile cost is paid once at boot, selection cost is paid
// on every matched request, so both are tracked separately.
const middlewareInputs = Array.from({ length: 60 }, (_, index) => ({
	scope: index % 4 === 0 ? 'global' : 'route',
	middleware: defineServerMiddleware({
		name: `mw-${index}`,
		phase: 'request',
		match: { paths: `/api/section-${index}/[id]` },
		handler: async (_ctx, next) => next(),
	}),
}));
middlewareInputs.push({
	scope: 'engine',
	middleware: defineServerMiddleware({
		name: 'security',
		phase: 'request',
		handler: async (_ctx, next) => next(),
	}),
});
const compiledMiddlewareGraph = compileServerMiddlewareGraph(middlewareInputs);
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
		name: 'route.trie-match',
		iterations: Math.max(100, options.iterations / 10),
		operation: () =>
			matchRouteTrie(routeTrie, `/catalog/category-${routeIndex++ % 48}/42`),
	},
	{
		name: 'route.table-scan-large',
		iterations: Math.max(100, options.iterations / 10),
		operation: () => {
			const pathname = `/catalog/category-${routeIndex++ % 500}/42`;
			for (const route of largeRouteTable) {
				const match = matchRoutePattern(route, pathname);
				if (match) return match;
			}
			return null;
		},
	},
	{
		name: 'route.trie-match-large',
		iterations: Math.max(100, options.iterations / 10),
		operation: () =>
			matchRouteTrie(
				largeRouteTrie,
				`/catalog/category-${routeIndex++ % 500}/42`
			),
	},
	{
		name: 'middleware.compile-graph',
		iterations: Math.max(50, options.iterations / 20),
		operation: () => compileServerMiddlewareGraph(middlewareInputs),
	},
	{
		name: 'middleware.select-chain',
		iterations: Math.max(100, options.iterations / 10),
		operation: () =>
			selectServerMiddlewareChain(compiledMiddlewareGraph, {
				pathname: `/api/section-${routeIndex++ % 60}/42`,
				method: 'GET',
				target: 'api',
			}),
	},
	{
		name: 'ssr.render-document',
		iterations: Math.max(20, options.iterations / 200),
		operation: () =>
			ssrRuntime.run(() => renderToFragment(ssrTree, ssrRuntime)),
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
