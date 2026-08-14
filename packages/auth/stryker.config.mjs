/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
	mutate: [
		'src/config.ts',
		'src/server/credentials.ts',
		'src/server/password-reset.ts',
		'src/server/oauth/flow.ts:426-531',
		'src/server/oauth/presets.ts:190-251',
		// Excludes only the equivalent explicit-undefined catch return at lines 52-54.
		'src/server/oauth/utils.ts:27-51',
	],
	testRunner: 'vitest',
	vitest: {
		configFile: 'vitest.config.ts',
		related: true,
	},
	coverageAnalysis: 'perTest',
	concurrency: 2,
	reporters: ['clear-text', 'json', 'html'],
	jsonReporter: {
		fileName: 'reports/mutation/mutation.json',
	},
	htmlReporter: {
		fileName: 'reports/mutation/index.html',
	},
	thresholds: {
		high: 100,
		low: 100,
		break: 100,
	},
	tempDirName: '.stryker-tmp',
};
