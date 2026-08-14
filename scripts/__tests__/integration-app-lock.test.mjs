import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rename,
	rm,
	stat,
	utimes,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	acquireIntegrationAppLock,
	getIntegrationAppLockDir,
	getProcessState,
	withIntegrationAppLock,
} from '../integration-app-lock.mjs';

const createTempLockDir = async () => {
	const root = await mkdtemp(join(tmpdir(), 'effuse-lock-test-'));
	return {
		lockDir: join(root, 'integration.lock'),
		root,
	};
};

const leaveOrphanedLock = (lockDir, repoRoot) =>
	new Promise((resolveChild, rejectChild) => {
		const moduleUrl = new URL('../integration-app-lock.mjs', import.meta.url)
			.href;
		const source = `
			const { acquireIntegrationAppLock } = await import(${JSON.stringify(moduleUrl)});
			await acquireIntegrationAppLock({
				lockDir: ${JSON.stringify(lockDir)},
				repoRoot: ${JSON.stringify(repoRoot)},
			});
		`;
		const child = spawn(
			process.execPath,
			['--input-type=module', '--eval', source],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let stderr = '';

		child.stderr.setEncoding('utf8');
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('error', rejectChild);
		child.on('close', (code) => {
			if (code === 0) {
				resolveChild(child.pid);
				return;
			}
			rejectChild(
				new Error(`Orphan lock child exited with ${code}: ${stderr}`)
			);
		});
	});

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

test('recovers a valid lock immediately when its owner process is dead', async () => {
	const { lockDir, root } = await createTempLockDir();
	try {
		const first = await acquireIntegrationAppLock({
			lockDir,
			pid: 42,
			repoRoot: root,
		});
		const inspectedPids = [];
		const second = await acquireIntegrationAppLock({
			getOwnerProcessState: (pid) => {
				inspectedPids.push(pid);
				return 'dead';
			},
			lockDir,
			repoRoot: root,
			staleMs: 60_000,
		});

		assert.deepEqual(inspectedPids, [42]);
		assert.notEqual(second.ownerId, first.ownerId);

		await first.release();
		const currentOwner = JSON.parse(
			await readFile(join(lockDir, 'owner.json'), 'utf8')
		);
		assert.equal(currentOwner.ownerId, second.ownerId);
		await second.release();
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('recovers a lock orphaned by a real exited process', async () => {
	const { lockDir, root } = await createTempLockDir();
	try {
		const orphanPid = await leaveOrphanedLock(lockDir, root);
		assert.equal(getProcessState(orphanPid), 'dead');

		const lock = await acquireIntegrationAppLock({
			lockDir,
			repoRoot: root,
			staleMs: 60_000,
			timeoutMs: 1_000,
		});

		assert.equal((await stat(lockDir)).isDirectory(), true);
		await lock.release();
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('treats a live or reused owner PID as active even when the lock is old', async () => {
	const { lockDir, root } = await createTempLockDir();
	let now = Date.now();
	try {
		const first = await acquireIntegrationAppLock({
			lockDir,
			pid: 42,
			repoRoot: root,
		});
		const staleDate = new Date(now - 60_000);
		await utimes(lockDir, staleDate, staleDate);

		await assert.rejects(
			acquireIntegrationAppLock({
				getOwnerProcessState: () => 'alive',
				lockDir,
				now: () => now,
				repoRoot: root,
				sleep: async (ms) => {
					now += ms;
				},
				staleMs: 1,
				timeoutMs: 2,
			}),
			/Timed out waiting for Effuse integration app lock/
		);

		await first.release();
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('uses age fallback when owner process liveness is unknown', async () => {
	const { lockDir, root } = await createTempLockDir();
	let now = Date.now();
	try {
		const first = await acquireIntegrationAppLock({
			lockDir,
			pid: 42,
			repoRoot: root,
		});

		await assert.rejects(
			acquireIntegrationAppLock({
				getOwnerProcessState: () => 'unknown',
				lockDir,
				now: () => now,
				repoRoot: root,
				sleep: async (ms) => {
					now += ms;
				},
				staleMs: 60_000,
				timeoutMs: 2,
			}),
			/Timed out waiting for Effuse integration app lock/
		);

		const staleDate = new Date(Date.now() - 60_000);
		await utimes(lockDir, staleDate, staleDate);
		const second = await acquireIntegrationAppLock({
			getOwnerProcessState: () => 'unknown',
			lockDir,
			repoRoot: root,
			staleMs: 1,
		});

		await first.release();
		assert.equal((await stat(lockDir)).isDirectory(), true);
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

test('recovers stale locks with mismatched ownership metadata', async () => {
	const { lockDir, root } = await createTempLockDir();
	try {
		await mkdir(lockDir);
		await writeFile(
			join(lockDir, 'owner.json'),
			JSON.stringify({
				ownerId: '57ef0638-7acd-4b16-b1ef-9b6b602a89db',
				pid: 42,
			})
		);
		await writeFile(
			join(lockDir, '.owner-6e900eb9-f67b-41f1-a3e7-3fbc7d4eea90'),
			''
		);
		const staleDate = new Date(Date.now() - 60_000);
		await utimes(lockDir, staleDate, staleDate);

		const lock = await acquireIntegrationAppLock({
			lockDir,
			repoRoot: root,
			staleMs: 1,
		});

		const entries = await readdir(lockDir);
		assert.equal(entries.includes(`.owner-${lock.ownerId}`), true);
		assert.equal(entries.length, 2);
		await lock.release();
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('recovers an interrupted transition only after it becomes stale', async () => {
	const { lockDir, root } = await createTempLockDir();
	let now = Date.now();
	try {
		const first = await acquireIntegrationAppLock({
			lockDir,
			repoRoot: root,
		});
		await rename(
			join(lockDir, `.owner-${first.ownerId}`),
			join(lockDir, '.recovery-57ef0638-7acd-4b16-b1ef-9b6b602a89db')
		);

		await assert.rejects(
			acquireIntegrationAppLock({
				lockDir,
				now: () => now,
				repoRoot: root,
				sleep: async (ms) => {
					now += ms;
				},
				staleMs: 60_000,
				timeoutMs: 2,
			}),
			/Timed out waiting for Effuse integration app lock/
		);

		const staleDate = new Date(Date.now() - 60_000);
		await utimes(lockDir, staleDate, staleDate);
		const second = await acquireIntegrationAppLock({
			lockDir,
			repoRoot: root,
			staleMs: 1,
		});

		await first.release();
		assert.equal((await stat(lockDir)).isDirectory(), true);
		await second.release();
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test('classifies process inspection failures conservatively', () => {
	assert.equal(
		getProcessState(42, () => undefined),
		'alive'
	);
	assert.equal(
		getProcessState(42, () => {
			const error = new Error('missing');
			error.code = 'ESRCH';
			throw error;
		}),
		'dead'
	);
	assert.equal(
		getProcessState(42, () => {
			const error = new Error('denied');
			error.code = 'EPERM';
			throw error;
		}),
		'unknown'
	);
	assert.equal(
		getProcessState(42, () => {
			throw new Error('unexpected');
		}),
		'unknown'
	);
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
