import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCommand } from '../run-with-integration-app-lock.mjs';
import { test } from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scriptPath = join(repoRoot, 'scripts/run-with-integration-app-lock.mjs');

const createTempLockDir = async () => {
	const root = await mkdtemp(join(tmpdir(), 'effuse-run-lock-test-'));
	return {
		lockDir: join(root, 'integration.lock'),
		root,
	};
};

const runCli = (lockDir, commandArgs) =>
	new Promise((resolveRun) => {
		const child = spawn(
			process.execPath,
			[scriptPath, '--', ...commandArgs],
			{
				cwd: repoRoot,
				env: {
					...process.env,
					EFFUSE_INTEGRATION_APP_LOCK_DIR: lockDir,
				},
				stdio: ['ignore', 'pipe', 'pipe'],
			}
		);
		let stdout = '';
		let stderr = '';

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('close', (code) => {
			resolveRun({ code, stderr, stdout });
		});
	});

test('parseCommand requires a command after the separator', () => {
	assert.deepEqual(parseCommand(['--', 'node', '--version']), {
		args: ['--version'],
		command: 'node',
	});
	assert.throws(() => parseCommand(['--']), /Usage:/);
});

test('root generated-output gates use the shared lock', async () => {
	const packageJson = JSON.parse(
		await readFile(join(repoRoot, 'package.json'), 'utf8')
	);
	const lockedPrefix =
		'node scripts/run-with-integration-app-lock.mjs -- ';

	for (const script of ['build', 'lint', 'test', 'typecheck']) {
		assert.ok(
			packageJson.scripts[script].startsWith(lockedPrefix),
			`Expected root ${script} to use the generated-output lock.`
		);
	}
	assert.equal(
		packageJson.scripts['check:app'],
		'node scripts/check-integration-app.mjs'
	);
	assert.equal(
		packageJson.scripts['check:app:bun'],
		'node scripts/check-integration-app.mjs --runner=bun'
	);
});

test('run-with-integration-app-lock forwards successful commands', async () => {
	const { lockDir, root } = await createTempLockDir();
	try {
		const result = await runCli(lockDir, [
			process.execPath,
			'-e',
			'process.stdout.write("ok")',
		]);

		assert.equal(result.code, 0);
		assert.equal(result.stdout, 'ok');
		assert.equal(result.stderr, '');
		await assert.rejects(stat(lockDir), { code: 'ENOENT' });
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('run-with-integration-app-lock forwards failing command exit codes', async () => {
	const { lockDir, root } = await createTempLockDir();
	try {
		const result = await runCli(lockDir, [
			process.execPath,
			'-e',
			'process.stderr.write("fail"); process.exit(7)',
		]);

		assert.equal(result.code, 7);
		assert.equal(result.stdout, '');
		assert.match(result.stderr, /fail/);
		assert.match(result.stderr, /exited with 7/);
		await assert.rejects(stat(lockDir), { code: 'ENOENT' });
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});
