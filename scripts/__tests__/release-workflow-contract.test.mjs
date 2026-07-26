import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readWorkflow = (name) =>
	readFile(new URL(`.github/workflows/${name}`, `file://${repoRoot}/`), 'utf8');
const readReleaseConfig = async () =>
	JSON.parse(
		await readFile(new URL('.releaserc.json', `file://${repoRoot}/`), 'utf8')
	);

test('quality CI protects dev and main promotions', async () => {
	const workflow = await readWorkflow('ci.yml');

	assert.match(workflow, /pull_request:\n\s+branches:\n\s+- dev\n\s+- main/u);
	assert.match(workflow, /push:\n\s+branches:\n\s+- dev\n\s+- main/u);
});

test('publication waits for every quality boundary', async () => {
	const workflow = await readWorkflow('release.yml');
	const commands = [
		'pnpm install --frozen-lockfile',
		'pnpm -r --workspace-concurrency=1 build',
		'pnpm lint',
		'pnpm typecheck',
		'pnpm test',
		'pnpm exec multi-semantic-release',
	];
	const positions = commands.map((command) => workflow.indexOf(command));

	assert.equal(
		positions.every((position) => position >= 0),
		true,
		'publication workflow is missing a required command'
	);
	assert.deepEqual(
		positions,
		[...positions].sort((left, right) => left - right)
	);
});

test('publication binds the scoped npm secret through setup-node', async () => {
	const workflow = await readWorkflow('release.yml');

	assert.match(
		workflow,
		/^\s+registry-url: https:\/\/registry\.npmjs\.org\/$/mu
	);
	assert.match(workflow, /package-manager-cache: false/u);
	assert.match(
		workflow,
		/^\s+NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}$/mu
	);
	assert.doesNotMatch(workflow, /^\s+NPM_TOKEN:/mu);
	assert.doesNotMatch(workflow, /^\s+id-token:/mu);
});

test('publication does not replay release activity across historical issues', async () => {
	const config = await readReleaseConfig();
	const githubPlugin = config.plugins.find(
		(plugin) => Array.isArray(plugin) && plugin[0] === '@semantic-release/github'
	);

	assert.ok(githubPlugin, 'GitHub release plugin must be configured explicitly');
	assert.equal(githubPlugin[1]?.successComment, false);
	assert.equal(githubPlugin[1]?.releasedLabels, false);
});

test('every public package identifies the trusted GitHub repository', async () => {
	const packagesRoot = new URL('packages/', `file://${repoRoot}/`);
	const packageDirectories = (
		await readdir(packagesRoot, { withFileTypes: true })
	).filter((entry) => entry.isDirectory());

	for (const directory of packageDirectories) {
		const manifest = JSON.parse(
			await readFile(
				new URL(`${directory.name}/package.json`, packagesRoot),
				'utf8'
			)
		);

		if (manifest.private !== true) {
			assert.equal(
				manifest.repository?.url,
				'https://github.com/chrismichaelps/effuse.git',
				`${manifest.name} must identify the trusted publisher repository`
			);
		}
	}
});
