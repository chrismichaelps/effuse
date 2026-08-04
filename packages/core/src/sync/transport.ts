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
 * The message channel between tabs.
 *
 * A port rather than a direct `BroadcastChannel` dependency, for two reasons
 * that matter equally.
 *
 * **Testability.** Cross-tab behaviour cannot be tested by opening real tabs.
 * With a port, N simulated tabs sharing an in-memory hub is a real test of the
 * real protocol rather than a mock of it — which is the only way the interesting
 * cases (crash handover, split brain, missed messages) can be exercised at all.
 *
 * **Environments.** `BroadcastChannel` does not exist during a server render and
 * is absent from some embedded webviews. A port lets those degrade to a no-op
 * transport where every tab is simply alone, instead of throwing on import.
 */

/** A message crossing the channel. Must survive structured cloning. */
export type SyncMessage = Readonly<Record<string, unknown>>;

export interface SyncTransport {
	/** Sends to every other participant. Never delivered to the sender. */
	post(message: SyncMessage): void;
	/** Registers a handler. Returns an unsubscribe function. */
	subscribe(handler: (message: SyncMessage) => void): () => void;
	/** Releases the underlying channel. Idempotent. */
	close(): void;
	/** False when messages go nowhere, so callers can skip coordination entirely. */
	readonly connected: boolean;
}

interface BroadcastChannelLike {
	postMessage(message: unknown): void;
	close(): void;
	addEventListener(
		type: 'message',
		listener: (event: { data: unknown }) => void
	): void;
	removeEventListener(
		type: 'message',
		listener: (event: { data: unknown }) => void
	): void;
}

type BroadcastChannelConstructor = new (name: string) => BroadcastChannelLike;

const getBroadcastChannel = (): BroadcastChannelConstructor | undefined => {
	const candidate = (
		globalThis as { BroadcastChannel?: BroadcastChannelConstructor }
	).BroadcastChannel;

	return typeof candidate === 'function' ? candidate : undefined;
};

/**
 * A transport that discards everything.
 *
 * Used where there is no channel — a server render, or a webview without
 * `BroadcastChannel`. Every tab believes it is alone, which is exactly right:
 * one participant needs no coordination, and the leader election below then
 * elects it immediately rather than hanging waiting for peers that cannot reply.
 */
export const createNoopTransport = (): SyncTransport => ({
	post: () => undefined,
	subscribe: () => () => undefined,
	close: () => undefined,
	connected: false,
});

/** A transport over `BroadcastChannel`, or a no-op where that is unavailable. */
export const createBroadcastTransport = (channelName: string): SyncTransport => {
	const Channel = getBroadcastChannel();
	if (Channel === undefined) return createNoopTransport();

	let channel: BroadcastChannelLike | undefined = new Channel(channelName);
	const handlers = new Set<(message: SyncMessage) => void>();

	const onMessage = (event: { data: unknown }): void => {
		const data = event.data;
		if (typeof data !== 'object' || data === null) return;

		// Iterated over a copy so a handler that unsubscribes during dispatch
		// cannot cause a peer to be skipped.
		for (const handler of [...handlers]) {
			try {
				handler(data as SyncMessage);
			} catch {
				// One bad handler must not stop the others from seeing the message.
				// A sign-out that reaches half the listeners is worse than one that
				// logs an error and reaches all of them.
			}
		}
	};

	channel.addEventListener('message', onMessage);

	return {
		post: (message) => {
			// A closed transport silently drops rather than throwing. Disposal races
			// with in-flight work constantly here — a tab closing mid-broadcast is
			// the normal case, not an exceptional one.
			if (channel === undefined) return;
			try {
				channel.postMessage(message);
			} catch {
				// Structured-clone failures and closed-channel races both land here.
				// Neither is worth taking the application down for.
			}
		},

		subscribe: (handler) => {
			handlers.add(handler);
			return () => {
				handlers.delete(handler);
			};
		},

		close: () => {
			if (channel === undefined) return;
			channel.removeEventListener('message', onMessage);
			channel.close();
			channel = undefined;
			handlers.clear();
		},

		get connected() {
			return channel !== undefined;
		},
	};
};

/**
 * An in-process hub that in-memory transports share.
 *
 * One hub stands in for one `BroadcastChannel` name; each transport created
 * against it is one tab.
 */
export interface MemoryTransportHub {
	/** Creates a participant. */
	connect(): SyncTransport;
	/** How many participants are currently open. */
	readonly size: () => number;
	/** Closes every participant. */
	closeAll(): void;
}

/**
 * Creates a hub for tests.
 *
 * Delivery is synchronous. A real `BroadcastChannel` delivers asynchronously,
 * so tests that depend on ordering across a delay must advance a clock rather
 * than rely on this — but synchronous delivery keeps the protocol tests
 * deterministic, which matters more than fidelity to a timing detail the
 * protocol must not depend on anyway.
 */
export const createMemoryTransportHub = (): MemoryTransportHub => {
	interface Participant {
		readonly handlers: Set<(message: SyncMessage) => void>;
		open: boolean;
	}

	const participants = new Set<Participant>();

	return {
		connect: () => {
			const self: Participant = { handlers: new Set(), open: true };
			participants.add(self);

			return {
				post: (message) => {
					if (!self.open) return;

					for (const peer of [...participants]) {
						// Never delivered to the sender, matching BroadcastChannel.
						if (peer === self || !peer.open) continue;

						for (const handler of [...peer.handlers]) {
							try {
								handler(message);
							} catch {
								// Isolated, as in the real transport.
							}
						}
					}
				},

				subscribe: (handler) => {
					self.handlers.add(handler);
					return () => {
						self.handlers.delete(handler);
					};
				},

				close: () => {
					self.open = false;
					self.handlers.clear();
					participants.delete(self);
				},

				get connected() {
					return self.open;
				},
			};
		},

		size: () => participants.size,

		closeAll: () => {
			for (const participant of participants) {
				participant.open = false;
				participant.handlers.clear();
			}
			participants.clear();
		},
	};
};
