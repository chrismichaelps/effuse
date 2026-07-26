import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentVisibility } from './index.js';

describe('useDocumentVisibility', () => {
	let currentState: DocumentVisibilityState;
	let listeners: Set<() => void>;
	let addEventListener: ReturnType<typeof vi.fn>;
	let removeEventListener: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		currentState = 'visible';
		listeners = new Set();
		addEventListener = vi.fn((_event: string, listener: EventListener) => {
			listeners.add(listener);
		});
		removeEventListener = vi.fn((_event: string, listener: EventListener) => {
			listeners.delete(listener);
		});
		vi.stubGlobal('window', {});
		vi.stubGlobal('document', {
			get visibilityState() {
				return currentState;
			},
			addEventListener,
			removeEventListener,
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('supports a zero-argument call and synchronizes on mount', () => {
		const visibility = useDocumentVisibility();

		expect(visibility.state.value).toBe('visible');
		expect(visibility.isVisible.value).toBe(true);
		expect(visibility.isHidden.value).toBe(false);
		expect(visibility.isSupported.value).toBe(true);
		expect(visibility.error.value).toBeNull();
		expect(addEventListener).toHaveBeenCalledWith(
			'visibilitychange',
			expect.any(Function)
		);
	});

	it('reacts to visibility changes', () => {
		const visibility = useDocumentVisibility();

		currentState = 'hidden';
		for (const listener of listeners) listener();

		expect(visibility.state.value).toBe('hidden');
		expect(visibility.isVisible.value).toBe(false);
		expect(visibility.isHidden.value).toBe(true);
	});

	it('reports unsupported document environments', () => {
		vi.stubGlobal('document', {});

		const visibility = useDocumentVisibility();

		expect(visibility.state.value).toBe('unknown');
		expect(visibility.isSupported.value).toBe(false);
		expect(visibility.error.value).toBeNull();
	});

	it('captures listener setup failures', () => {
		const cause = new Error('denied');
		addEventListener.mockImplementation(() => {
			throw cause;
		});

		const visibility = useDocumentVisibility();

		expect(visibility.isSupported.value).toBe(false);
		expect(visibility.error.value).toMatchObject({
			name: 'DocumentVisibilityError',
			code: 'LISTENER_FAILED',
			cause,
		});
	});

	it('uses an explicit SSR assumption without scheduling browser work', () => {
		vi.stubGlobal('window', undefined);
		vi.stubGlobal('document', undefined);

		const visibility = useDocumentVisibility({ ssrState: 'hidden' });

		expect(visibility.state.value).toBe('hidden');
		expect(visibility.isHidden.value).toBe(true);
		expect(visibility.isSupported.value).toBe(false);
		expect(addEventListener).not.toHaveBeenCalled();
	});
});
