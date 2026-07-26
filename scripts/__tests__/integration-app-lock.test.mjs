import assert from 'node:assert/strict';
import {
	mkdir,
	mkdtemp,
	rm,
	stat,
	utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	acquireIntegrationAppLock,
	getIntegrationAppLockDir,
	withIntegrationAppLock,
} from '../integration-app-lock.mjs';

const createTempLockDir = async () => {
	const root = await mkdtemp(join(tmpdir(), 'effuse-lock-test-'));
	return {
		lockDir: join(root, 'integration.lock'),
		root,
	};
};

test('acquires and releases the integration app lock', async () => {
	const { lockDir, root } = await createTempLockDir();
	try {
		const lock = await acquireIntegrationAppLock({
			lockDir,
			repoRoot: root,
		});

		assert.equal((await stat(lockDir)).isDirectory(), true);
		await lock.release();

		await assert.rejects(stat(lockDir), { code: 'ENOENT' });
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('waits for an active lock before acquiring it', async () => {
	const { lockDir, root } = await createTempLockDir();
	try {
		const first = await acquireIntegrationAppLock({
			lockDir,
			repoRoot: root,
		});
		let sleeps = 0;
		const secondPromise = acquireIntegrationAppLock({
			lockDir,
			pollMs: 1,
			repoRoot: root,
			sleep: async () => {
				sleeps += 1;
				if (sleeps === 1) {
					await first.release();
				}
			},
			timeoutMs: 20,
		});

		const second = await secondPromise;
		assert.equal(sleeps, 1);
		await second.release();
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('recovers stale integration app locks', async () => {
	const { lockDir, root } = await createTempLockDir();
	try {
		await mkdir(lockDir);
		const staleDate = new Date(Date.now() - 60_000);
		await utimes(lockDir, staleDate, staleDate);

		const lock = await acquireIntegrationAppLock({
			lockDir,
			repoRoot: root,
			staleMs: 1,
		});

		assert.equal((await stat(lockDir)).isDirectory(), true);
		await lock.release();
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('times out when the integration app lock remains active', async () => {
	const { lockDir, root } = await createTempLockDir();
	let now = 0;
	try {
		await mkdir(lockDir);

		await assert.rejects(
			acquireIntegrationAppLock({
				lockDir,
				now: () => now,
				pollMs: 5,
				repoRoot: root,
				sleep: async (ms) => {
					now += ms;
				},
				timeoutMs: 10,
			}),
			/Timed out waiting for Effuse integration app lock/
		);
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('withIntegrationAppLock releases after callback failures', async () => {
	const { lockDir, root } = await createTempLockDir();
	try {
		await assert.rejects(
			withIntegrationAppLock(
				{
					lockDir,
					repoRoot: root,
				},
				async () => {
					throw new Error('boom');
				}
			),
			/boom/
		);

		await assert.rejects(stat(lockDir), { code: 'ENOENT' });
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('derives a stable repo-scoped lock directory', () => {
	assert.equal(
		getIntegrationAppLockDir('/tmp/effuse'),
		getIntegrationAppLockDir('/tmp/effuse')
	);
	assert.notEqual(
		getIntegrationAppLockDir('/tmp/effuse-a'),
		getIntegrationAppLockDir('/tmp/effuse-b')
	);
});
