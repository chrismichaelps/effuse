import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
	CreateElementNode,
	CreateTextNode,
	EFFUSE_NODE,
	createHandler,
	createServerApp,
	createSSRRuntime,
	define,
} from '../../packages/core/dist/server.js';
import {
	evaluateBudgets,
	formatResults,
	percentile,
	runAsyncBenchmark,
	runtimeMetadata,
} from './benchmark.mjs';

const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const options = quick
	? { warmup: 1, samples: 4, iterations: 2 }
	: { warmup: 2, samples: 10, iterations: 5 };
const coldSampleCount = quick ? 3 : 7;
const entryUrl = new URL('../../packages/core/dist/index.js', import.meta.url)
	.href;
const workerPath = fileURLToPath(
	new URL('./ssr-cold-worker.mjs', import.meta.url)
);
const Root = define({
	name: 'SSRRuntimeBenchmark',
	script: () => ({}),
	template: () =>
		CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'main',
			props: { id: 'app' },
			children: [
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'h1',
					props: {},
					children: [
						CreateTextNode({ [EFFUSE_NODE]: true, text: 'Effuse SSR' }),
					],
				}),
			],
		}),
});
const serverApp = createServerApp(Root);
const handler = createHandler({ root: Root });

const cases = [
	{
		name: 'ssr.runtime-lifecycle',
		operation: async () => {
			const runtime = await createSSRRuntime([]);
			await runtime.dispose();
		},
	},
	{
		name: 'ssr.full-render',
		operation: () => serverApp.renderToString('/benchmark'),
	},
	{
		name: 'ssr.handler',
		operation: async () => {
			const response = await handler(new Request('http://localhost/benchmark'));
			return response.text();
		},
	},
];
const results = [];
for (const benchmark of cases) {
	results.push(await runAsyncBenchmark({ ...options, ...benchmark }));
}

const coldSamples = [];
for (let sample = 0; sample < coldSampleCount; sample++) {
	const child = spawnSync(process.execPath, [workerPath, entryUrl], {
		cwd: new URL('../..', import.meta.url),
		encoding: 'utf8',
	});
	if (child.status !== 0) {
		throw new Error(child.stderr || `Cold worker exited with ${child.status}.`);
	}
	coldSamples.push(JSON.parse(child.stdout.trim()));
}

const coldTotalMs = coldSamples.map((sample) => sample.totalMs);
const cold = {
	samples: coldSampleCount,
	medianMs: percentile(coldTotalMs, 0.5),
	p95Ms: percentile(coldTotalMs, 0.95),
	importMedianMs: percentile(
		coldSamples.map((sample) => sample.importMs),
		0.5
	),
	requestMedianMs: percentile(
		coldSamples.map((sample) => sample.requestMs),
		0.5
	),
};
const metadata = runtimeMetadata();
const report = {
	schemaVersion: 1,
	configuration: options,
	...metadata,
	warmResults: results,
	cold,
};

if (args.has('--json')) console.log(JSON.stringify(report, null, 2));
else {
	formatResults(results);
	console.table([{ runtime: metadata.runtime, ...cold }]);
}

if (args.has('--check')) {
	const budgets = JSON.parse(
		await readFile(
			new URL('./ssr-runtime-budgets.json', import.meta.url),
			'utf8'
		)
	);
	const failures = evaluateBudgets(results, budgets.warm);
	const coldBudget = budgets.cold[metadata.runtime];
	if (!coldBudget)
		failures.push(`Missing cold budget for ${metadata.runtime}.`);
	else {
		if (cold.medianMs > coldBudget.medianMs) {
			failures.push(
				`ssr.cold-start: median ${cold.medianMs.toFixed(1)}ms exceeds ${coldBudget.medianMs}ms`
			);
		}
		if (cold.p95Ms > coldBudget.p95Ms) {
			failures.push(
				`ssr.cold-start: p95 ${cold.p95Ms.toFixed(1)}ms exceeds ${coldBudget.p95Ms}ms`
			);
		}
	}
	if (failures.length > 0) {
		console.error(`Performance budget failed:\n${failures.join('\n')}`);
		process.exitCode = 1;
	}
}
