/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
	mutate: [
		'src/config.ts',
		'src/server/credentials.ts',
		'src/server/password-reset.ts',
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
