import test from 'node:test';
import assert from 'node:assert/strict';
import {
	evaluateBudgets,
	percentile,
	runBenchmark,
	summarize,
} from '../performance/benchmark.mjs';

test('summarizes benchmark samples without mutating input', () => {
	const samples = [50, 10, 40, 20, 30];
	assert.deepEqual(summarize(samples), {
		medianNs: 30,
		p95Ns: 50,
		minNs: 10,
		maxNs: 50,
		meanNs: 30,
		standardDeviationNs: Math.sqrt(200),
	});
	assert.deepEqual(samples, [50, 10, 40, 20, 30]);
	assert.equal(percentile(samples, 0), 10);
});

test('runs warmup separately and reports nanoseconds per operation', () => {
	let calls = 0;
	let time = 0;
	const result = runBenchmark({
		name: 'deterministic',
		operation: () => ++calls,
		warmup: 2,
		samples: 3,
		iterations: 4,
		now: () => (time += 2),
	});

	assert.equal(calls, 20);
	assert.equal(result.medianNs, 500_000);
	assert.equal(result.p95Ns, 500_000);
});

test('reports missing and exceeded budgets', () => {
	const results = [
		{ name: 'fast', medianNs: 10, p95Ns: 20 },
		{ name: 'slow', medianNs: 30, p95Ns: 80 },
		{ name: 'unbudgeted', medianNs: 1, p95Ns: 1 },
	];
	assert.deepEqual(
		evaluateBudgets(results, {
			fast: { medianNs: 10, p95Ns: 20 },
			slow: { medianNs: 20, p95Ns: 50 },
		}),
		[
			'slow: medianNs 30ns exceeds 20ns',
			'slow: p95Ns 80ns exceeds 50ns',
			'unbudgeted: missing budget',
		]
	);
});

test('rejects invalid sample configuration', () => {
	assert.throws(
		() =>
			runBenchmark({
				name: 'invalid',
				operation: () => undefined,
				warmup: 0,
			}),
		/warmup must be a positive integer/
	);
});
