import { performance } from 'node:perf_hooks';

let sink;

const assertPositiveInteger = (value, name) => {
	if (!Number.isInteger(value) || value < 1) {
		throw new TypeError(`${name} must be a positive integer.`);
	}
};

export const percentile = (values, percent) => {
	if (values.length === 0) throw new TypeError('Cannot summarize no samples.');
	if (percent < 0 || percent > 1) {
		throw new TypeError('Percentile must be between 0 and 1.');
	}
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.ceil(percent * sorted.length) - 1] ?? sorted[0];
};

export const summarize = (samples) => {
	if (samples.length === 0) throw new TypeError('Cannot summarize no samples.');
	const mean =
		samples.reduce((total, value) => total + value, 0) / samples.length;
	const variance =
		samples.reduce((total, value) => total + (value - mean) ** 2, 0) /
		samples.length;
	return {
		medianNs: percentile(samples, 0.5),
		p95Ns: percentile(samples, 0.95),
		minNs: Math.min(...samples),
		maxNs: Math.max(...samples),
		meanNs: mean,
		standardDeviationNs: Math.sqrt(variance),
	};
};

export const runBenchmark = ({
	name,
	operation,
	warmup = 5,
	samples = 30,
	iterations = 10_000,
	now = () => performance.now(),
}) => {
	assertPositiveInteger(warmup, 'warmup');
	assertPositiveInteger(samples, 'samples');
	assertPositiveInteger(iterations, 'iterations');

	for (let index = 0; index < warmup * iterations; index++) sink = operation();

	const timings = [];
	for (let sample = 0; sample < samples; sample++) {
		const startedAt = now();
		for (let index = 0; index < iterations; index++) sink = operation();
		const durationMs = now() - startedAt;
		timings.push((durationMs * 1_000_000) / iterations);
	}

	return { name, samples, iterations, ...summarize(timings) };
};

export const runAsyncBenchmark = async ({
	name,
	operation,
	warmup = 2,
	samples = 10,
	iterations = 10,
	now = () => performance.now(),
}) => {
	assertPositiveInteger(warmup, 'warmup');
	assertPositiveInteger(samples, 'samples');
	assertPositiveInteger(iterations, 'iterations');

	for (let index = 0; index < warmup * iterations; index++) {
		sink = await operation();
	}

	const timings = [];
	for (let sample = 0; sample < samples; sample++) {
		const startedAt = now();
		for (let index = 0; index < iterations; index++) {
			sink = await operation();
		}
		const durationMs = now() - startedAt;
		timings.push((durationMs * 1_000_000) / iterations);
	}

	return { name, samples, iterations, ...summarize(timings) };
};

export const evaluateBudgets = (results, budgets) => {
	const failures = [];
	const resultsByName = new Map(results.map((result) => [result.name, result]));
	for (const result of results) {
		const budget = budgets[result.name];
		if (!budget) {
			failures.push(`${result.name}: missing budget`);
			continue;
		}
		for (const metric of ['medianNs', 'p95Ns']) {
			if (budget[metric] !== undefined && result[metric] > budget[metric]) {
				failures.push(
					`${result.name}: ${metric} ${Math.round(result[metric])}ns exceeds ${budget[metric]}ns`
				);
			}
		}

		if (budget.relativeTo) {
			const baseline = resultsByName.get(budget.relativeTo);
			if (!baseline) {
				failures.push(
					`${result.name}: relative baseline ${budget.relativeTo} is missing`
				);
				continue;
			}
			for (const [metric, ratioBudget] of [
				['medianNs', budget.maxMedianRatio],
				['p95Ns', budget.maxP95Ratio],
			]) {
				if (ratioBudget === undefined) continue;
				const ratio = result[metric] / baseline[metric];
				if (ratio > ratioBudget) {
					failures.push(
						`${result.name}: ${metric} ratio ${ratio.toFixed(2)}x exceeds ${ratioBudget}x relative to ${budget.relativeTo}`
					);
				}
			}
		}
	}
	return failures;
};

export const runtimeMetadata = () => ({
	runtime: globalThis.Bun ? 'bun' : 'node',
	runtimeVersion: globalThis.Bun?.version ?? process.versions.node,
	platform: process.platform,
	architecture: process.arch,
});

export const formatResults = (results) => {
	const rows = results.map((result) => ({
		benchmark: result.name,
		'median (ns/op)': Math.round(result.medianNs),
		'p95 (ns/op)': Math.round(result.p95Ns),
		'stddev (ns/op)': Math.round(result.standardDeviationNs),
	}));
	return console.table(rows);
};
