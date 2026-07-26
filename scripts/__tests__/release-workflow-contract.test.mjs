import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readWorkflow = (name) =>
	readFile(new URL(`.github/workflows/${name}`, `file://${repoRoot}/`), 'utf8');

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
