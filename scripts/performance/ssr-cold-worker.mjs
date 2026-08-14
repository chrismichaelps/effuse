const entry = process.argv[2];
if (!entry) throw new TypeError('Expected a core entry URL.');

const startedAt = performance.now();
const core = await import(entry);
const importedAt = performance.now();
const App = core.define({
	name: 'ColdStartBenchmark',
	script: () => ({}),
	template: () =>
		core.CreateElementNode({
			[core.EFFUSE_NODE]: true,
			tag: 'main',
			props: {},
			children: [
				core.CreateTextNode({ [core.EFFUSE_NODE]: true, text: 'ready' }),
			],
		}),
});
const handler = core.createHandler({ root: App });
const response = await handler(new Request('http://localhost/'));
await response.text();
const completedAt = performance.now();

console.log(
	JSON.stringify({
		importMs: importedAt - startedAt,
		requestMs: completedAt - importedAt,
		totalMs: completedAt - startedAt,
	})
);
