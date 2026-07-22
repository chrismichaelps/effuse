import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	DebounceError,
	DebounceState,
	EventListenerError,
	IntervalError,
	ListenerState,
	LocalStorageError,
	MediaQueryError,
	MediaQueryState,
	NetworkError,
	NetworkState,
	StorageState,
	ThrottleError,
	ThrottleState,
	WindowSizeError,
	WindowSizeState,
} from './index.js';

describe('@effuse/use public contracts', () => {
	it('constructs and narrows generic tagged states without Effect types', () => {
		const pending = DebounceState.Pending({
			value: 'ready',
			pendingValue: 'next',
		});
		const throttled = ThrottleState.Throttled({ value: 2, lastValue: 1 });
		const loaded = StorageState.Loaded({ value: { id: 42 } });

		expectTypeOf(pending.value).toEqualTypeOf<string>();
		expectTypeOf(throttled.lastValue).toEqualTypeOf<number>();
		expectTypeOf(loaded.value).toEqualTypeOf<{ id: number }>();
		expect(DebounceState.$is('Pending')(pending)).toBe(true);
		expect(ThrottleState.$is('Throttled')(throttled)).toBe(true);
		expect(StorageState.$is('Loaded')(loaded)).toBe(true);
	});

	it('supports direct and curried exhaustive matching', () => {
		const available = WindowSizeState.Available({ width: 1280, height: 720 });
		const direct = WindowSizeState.$match(available, {
			Unavailable: () => 'unavailable',
			Available: ({ width, height }) => `${String(width)}x${String(height)}`,
		});
		const matchNetwork = NetworkState.$match({
			Online: () => true,
			Offline: () => false,
			Unknown: () => false,
		});

		expect(direct).toBe('1280x720');
		expect(matchNetwork(NetworkState.Online())).toBe(true);
		expect(MediaQueryState.$is('Matched')(MediaQueryState.Matched())).toBe(true);
		expect(ListenerState.$is('Inactive')(ListenerState.Inactive())).toBe(true);
	});

	it('preserves tagged error construction and native Error behavior', () => {
		const errors = [
			new DebounceError({ reason: 'delay' }),
			new ThrottleError({ reason: 'interval' }),
			new IntervalError({ reason: 'timer' }),
			new LocalStorageError({
				key: 'session',
				operation: 'read',
				reason: 'denied',
			}),
			new EventListenerError({ eventName: 'click', reason: 'detached' }),
			new MediaQueryError({ query: '(width > 1px)', reason: 'invalid' }),
			new NetworkError({ reason: 'offline' }),
			new WindowSizeError({ reason: 'unavailable' }),
		];

		for (const error of errors) {
			expect(error).toBeInstanceOf(Error);
			expect(error._tag).toBeTruthy();
		}
		expect(errors[0]).toBeInstanceOf(DebounceError);
		expect(errors[0]?.message).toBe('[useDebounce] delay');
	});
});
