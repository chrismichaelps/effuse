import { createHash } from 'node:crypto';
import {
	mkdir,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_STALE_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_POLL_MS = 250;

const delay = (ms) =>
	new Promise((resolveDelay) => {
		setTimeout(resolveDelay, ms);
	});

export const getIntegrationAppLockDir = (repoRoot) => {
	const key = createHash('sha256').update(repoRoot).digest('hex').slice(0, 16);
	return join(tmpdir(), `effuse-integration-app-${key}.lock`);
};

const isStaleLock = async (lockDir, staleMs, now) => {
	try {
		const stats = await stat(lockDir);
		return now() - stats.mtimeMs > staleMs;
	} catch {
		return false;
	}
};

export const acquireIntegrationAppLock = async ({
	lockDir,
	now = Date.now,
	pollMs = DEFAULT_POLL_MS,
	repoRoot,
	sleep = delay,
	staleMs = DEFAULT_STALE_MS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
	const resolvedLockDir = lockDir ?? getIntegrationAppLockDir(repoRoot);
	const startedAt = now();

	for (;;) {
		try {
			await mkdir(resolvedLockDir);
			await writeFile(
				join(resolvedLockDir, 'owner.json'),
				JSON.stringify(
					{
						acquiredAt: new Date(now()).toISOString(),
						pid: process.pid,
						repoRoot,
					},
					null,
					2
				)
			);

			let released = false;
			return {
				lockDir: resolvedLockDir,
				release: async () => {
					if (released) return;
					released = true;
					await rm(resolvedLockDir, { force: true, recursive: true });
				},
			};
		} catch (error) {
			if (error?.code !== 'EEXIST') {
				throw error;
			}

			if (await isStaleLock(resolvedLockDir, staleMs, now)) {
				await rm(resolvedLockDir, { force: true, recursive: true });
				continue;
			}

			if (now() - startedAt >= timeoutMs) {
				throw new Error(
					`Timed out waiting for Effuse integration app lock at ${resolvedLockDir}.`
				);
			}

			await sleep(pollMs);
		}
	}
};

export const withIntegrationAppLock = async (options, run) => {
	const lock = await acquireIntegrationAppLock(options);
	try {
		return await run(lock);
	} finally {
		await lock.release();
	}
};
