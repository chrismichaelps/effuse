/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * A {@link SessionStore} over any key-value storage.
 *
 * This is where the "no fifteen-method adapter" claim is cashed. The prevailing
 * design asks for `createUser`, `getUser`, `getUserByEmail`, `getUserByAccount`,
 * `updateUser`, `deleteUser`, `linkAccount`, `unlinkAccount`, `createSession`,
 * `getSessionAndUser`, `updateSession`, `deleteSession`, `createVerificationToken`,
 * `useVerificationToken`, and more — all or nothing, per backend.
 *
 * Sessions need `get`, `set`, `delete`, and a namespace. Anything that can do
 * that is a session backend: `createMemoryStorage()` from `@effuse/server`, a
 * thirty-line Redis wrapper, or a Cloudflare KV binding. Nothing about users or
 * accounts is involved, because sessions are not users.
 */

import { randomBytes } from 'node:crypto';
import type {
	AuthStorage,
	Clock,
	LockHandle,
	SessionId,
	SessionStore,
	StoredSession,
} from '../contract.js';

export interface StorageSessionStoreOptions {
	readonly storage: AuthStorage;
	readonly clock: Clock;
	/**
	 * TTL applied to each stored session.
	 *
	 * Should match the absolute session lifetime. Records then expire on their
	 * own, so a store never accumulates dead sessions from users who close a tab
	 * instead of signing out — which, left unbounded, is most of them.
	 */
	readonly ttlMs: number;
}

const SESSIONS = 'sessions';
const SUBJECT_INDEX = 'subjects';
const LOCKS = 'locks';

interface LockRecord {
	readonly token: string;
	readonly expiresAt: number;
}

/**
 * Builds a {@link SessionStore} on top of {@link AuthStorage}.
 *
 * Three namespaces: the sessions themselves, a subject-to-session-ids index,
 * and locks. The index exists so `destroyForSubject` is a keyed lookup rather
 * than a scan of every session in the store — the difference between an
 * instant "sign out everywhere" and one that degrades as the product grows.
 */
export const createStorageSessionStore = (
	options: StorageSessionStoreOptions
): SessionStore => {
	const { storage, clock, ttlMs } = options;

	const sessions = storage.namespace(SESSIONS);
	const subjects = storage.namespace(SUBJECT_INDEX);
	const locks = storage.namespace(LOCKS);

	const indexSubject = async (
		subject: string,
		id: SessionId
	): Promise<void> => {
		const existing = (await subjects.get<readonly string[]>(subject)) ?? [];
		if (existing.includes(id)) return;
		await subjects.set(subject, [...existing, id], { ttlMs });
	};

	return {
		read: async (id) => sessions.get<StoredSession>(id),

		write: async (session) => {
			await sessions.set(session.id, session, { ttlMs });
			await indexSubject(session.subject, session.id);
		},

		destroy: async (id) => {
			const existing = await sessions.get<StoredSession>(id);
			await sessions.delete(id);

			if (existing === undefined) return;

			// Prune the index too. A stale id left behind would make a later
			// `destroyForSubject` do pointless work forever.
			const ids = (await subjects.get<readonly string[]>(existing.subject)) ?? [];
			const remaining = ids.filter((candidate) => candidate !== id);

			if (remaining.length === 0) {
				await subjects.delete(existing.subject);
				return;
			}
			await subjects.set(existing.subject, remaining, { ttlMs });
		},

		destroyForSubject: async (subject) => {
			const ids = (await subjects.get<readonly string[]>(subject)) ?? [];

			await Promise.all(ids.map(async (id) => sessions.delete(id)));
			await subjects.delete(subject);

			return ids.length;
		},

		acquireLock: async (key, lockTtlMs) => {
			const held = await locks.get<LockRecord>(key);

			// An expired record is treated as free. Without this, a process that
			// died holding the lock would wedge the session until the TTL a backend
			// may or may not honour finally fired.
			if (held !== undefined && held.expiresAt > clock.now()) {
				return undefined;
			}

			const token = randomBytes(16).toString('base64url');
			await locks.set(
				key,
				{ token, expiresAt: clock.now() + lockTtlMs } satisfies LockRecord,
				{ ttlMs: lockTtlMs }
			);

			// Read back to confirm we won. On a backend without atomic
			// check-and-set this narrows the window rather than closing it, which is
			// why the conformance suite tests exclusivity explicitly and the docs
			// call for a compare-and-set primitive where the backend offers one.
			const confirmed = await locks.get<LockRecord>(key);
			if (confirmed?.token !== token) return undefined;

			const handle: LockHandle = {
				key,
				token,
				release: async () => {
					// Fencing. A holder whose TTL lapsed must not release the lock its
					// successor now owns.
					const current = await locks.get<LockRecord>(key);
					if (current?.token !== token) return;
					await locks.delete(key);
				},
			};

			return handle;
		},
	};
};
