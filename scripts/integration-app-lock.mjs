import { createHash, randomUUID } from 'node:crypto';
import {
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	rmdir,
	stat,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_STALE_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_POLL_MS = 250;
const OWNER_FILE = 'owner.json';
const OWNER_TOKEN_PREFIX = '.owner-';
const RECOVERY_MARKER = '.recovery-claim';
const RECOVERY_PREFIX = '.recovery-';
const RELEASE_PREFIX = '.release-';
const OWNER_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROCESS_ALIVE = 'alive';
const PROCESS_DEAD = 'dead';
const PROCESS_UNKNOWN = 'unknown';

const delay = (ms) =>
	new Promise((resolveDelay) => {
		setTimeout(resolveDelay, ms);
	});

const isMissing = (error) => error?.code === 'ENOENT';

const readOwner = async (lockDir) => {
	try {
		const value = JSON.parse(await readFile(join(lockDir, OWNER_FILE), 'utf8'));
		if (
			typeof value !== 'object' ||
			value === null ||
			!OWNER_ID_PATTERN.test(value.ownerId) ||
			!Number.isSafeInteger(value.pid) ||
			value.pid <= 0
		) {
			return null;
		}

		return value;
	} catch {
		return null;
	}
};

const readLockSnapshot = async (lockDir, staleMs, now) => {
	try {
		const [entries, owner, stats] = await Promise.all([
			readdir(lockDir),
			readOwner(lockDir),
			stat(lockDir),
		]);
		return {
			entries,
			identity: `${stats.dev}:${stats.ino}`,
			owner,
			stale: now() - stats.mtimeMs > staleMs,
		};
	} catch {
		return null;
	}
};

const findTransitionMarker = (entries) =>
	entries.find(
		(entry) =>
			entry === RECOVERY_MARKER ||
			entry.startsWith(RECOVERY_PREFIX) ||
			entry.startsWith(RELEASE_PREFIX)
	);

export const getProcessState = (pid, signalProcess = process.kill) => {
	try {
		signalProcess(pid, 0);
		return PROCESS_ALIVE;
	} catch (error) {
		return error?.code === 'ESRCH' ? PROCESS_DEAD : PROCESS_UNKNOWN;
	}
};

export const getIntegrationAppLockDir = (repoRoot) => {
	const key = createHash('sha256').update(repoRoot).digest('hex').slice(0, 16);
	return join(tmpdir(), `effuse-integration-app-${key}.lock`);
};

const quarantineClaimedLock = async (lockDir, recoveryId) => {
	const quarantineDir = `${lockDir}.recovered-${recoveryId}`;
	try {
		await rename(lockDir, quarantineDir);
	} catch (error) {
		if (isMissing(error)) return false;
		throw error;
	}

	await rm(quarantineDir, { force: true, recursive: true });
	return true;
};

const claimKnownGeneration = async (lockDir, sourceMarker, recoveryId) => {
	try {
		await rename(
			join(lockDir, sourceMarker),
			join(lockDir, `${RECOVERY_PREFIX}${recoveryId}`)
		);
		return true;
	} catch (error) {
		if (isMissing(error)) return false;
		throw error;
	}
};

const claimMalformedGeneration = async (lockDir, expectedIdentity) => {
	const markerPath = join(lockDir, RECOVERY_MARKER);
	try {
		await writeFile(markerPath, '', { flag: 'wx' });
	} catch (error) {
		if (error?.code === 'EEXIST' || isMissing(error)) return false;
		throw error;
	}

	try {
		const stats = await stat(lockDir);
		if (`${stats.dev}:${stats.ino}` !== expectedIdentity) {
			await rm(markerPath, { force: true });
			return false;
		}
		return true;
	} catch (error) {
		if (isMissing(error)) return false;
		throw error;
	}
};

const tryRecoverLock = async ({
	createOwnerId,
	getOwnerProcessState,
	lockDir,
	now,
	staleMs,
}) => {
	const snapshot = await readLockSnapshot(lockDir, staleMs, now);
	if (!snapshot) return false;

	const transitionMarker = findTransitionMarker(snapshot.entries);
	let sourceMarker = transitionMarker;

	if (transitionMarker) {
		if (!snapshot.stale) return false;
	} else if (snapshot.owner) {
		const ownerToken = `${OWNER_TOKEN_PREFIX}${snapshot.owner.ownerId}`;
		if (!snapshot.entries.includes(ownerToken)) {
			if (!snapshot.stale) return false;
			sourceMarker = null;
		} else {
			const processState = getOwnerProcessState(snapshot.owner.pid);
			if (processState === PROCESS_ALIVE) return false;
			if (processState === PROCESS_UNKNOWN && !snapshot.stale) return false;
			sourceMarker = ownerToken;
		}
	} else if (!snapshot.stale) {
		return false;
	}

	const recoveryId = createOwnerId();
	const claimed = sourceMarker
		? await claimKnownGeneration(lockDir, sourceMarker, recoveryId)
		: await claimMalformedGeneration(lockDir, snapshot.identity);

	if (!claimed) return false;
	return quarantineClaimedLock(lockDir, recoveryId);
};

const createRelease = ({ lockDir, ownerId }) => {
	let released = false;

	return async () => {
		if (released) return;
		released = true;

		const ownerToken = join(lockDir, `${OWNER_TOKEN_PREFIX}${ownerId}`);
		const releaseMarker = join(lockDir, `${RELEASE_PREFIX}${ownerId}`);
		try {
			await rename(ownerToken, releaseMarker);
		} catch (error) {
			if (isMissing(error)) return;
			throw error;
		}

		const owner = await readOwner(lockDir);
		if (owner?.ownerId !== ownerId) {
			try {
				await rename(releaseMarker, ownerToken);
			} catch (error) {
				if (!isMissing(error)) throw error;
			}
			return;
		}

		await rm(join(lockDir, OWNER_FILE), { force: true });
		await rm(releaseMarker, { force: true });
		try {
			await rmdir(lockDir);
		} catch (error) {
			if (!isMissing(error) && error?.code !== 'ENOTEMPTY') throw error;
		}
	};
};

export const acquireIntegrationAppLock = async ({
	createOwnerId = randomUUID,
	getOwnerProcessState = getProcessState,
	lockDir,
	now = Date.now,
	pid = process.pid,
	pollMs = DEFAULT_POLL_MS,
	repoRoot,
	sleep = delay,
	staleMs = DEFAULT_STALE_MS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
	const resolvedLockDir = lockDir ?? getIntegrationAppLockDir(repoRoot);
	const startedAt = now();
	const ownerId = createOwnerId();

	for (;;) {
		try {
			await mkdir(resolvedLockDir);
			try {
				await writeFile(
					join(resolvedLockDir, OWNER_FILE),
					JSON.stringify(
						{
							acquiredAt: new Date(now()).toISOString(),
							ownerId,
							pid,
							repoRoot,
						},
						null,
						2
					)
				);
				await writeFile(
					join(resolvedLockDir, `${OWNER_TOKEN_PREFIX}${ownerId}`),
					'',
					{ flag: 'wx' }
				);
			} catch (error) {
				await rm(resolvedLockDir, { force: true, recursive: true });
				throw error;
			}

			return {
				lockDir: resolvedLockDir,
				ownerId,
				release: createRelease({
					lockDir: resolvedLockDir,
					ownerId,
				}),
			};
		} catch (error) {
			if (error?.code !== 'EEXIST') throw error;

			if (
				await tryRecoverLock({
					createOwnerId,
					getOwnerProcessState,
					lockDir: resolvedLockDir,
					now,
					staleMs,
				})
			) {
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
