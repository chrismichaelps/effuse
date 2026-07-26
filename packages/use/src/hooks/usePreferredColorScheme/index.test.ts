import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreferredColorScheme } from './index.js';

class MockMediaQuery extends EventTarget {
	constructor(public matches: boolean) {
		super();
	}
}

describe('usePreferredColorScheme', () => {
	let darkQuery: MockMediaQuery;
	let lightQuery: MockMediaQuery;

	beforeEach(() => {
		darkQuery = new MockMediaQuery(false);
		lightQuery = new MockMediaQuery(true);
		vi.stubGlobal('document', {});
		vi.stubGlobal('window', {
			matchMedia: vi.fn((query: string) =>
				query.includes('dark') ? darkQuery : lightQuery
			),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('supports a zero-argument call and detects light preference', () => {
		const colorScheme = usePreferredColorScheme();

		expect(colorScheme.scheme.value).toBe('light');
		expect(colorScheme.isLight.value).toBe(true);
		expect(colorScheme.isDark.value).toBe(false);
		expect(colorScheme.hasPreference.value).toBe(true);
		expect(colorScheme.isSupported.value).toBe(true);
	});

	it('detects dark preference and reacts to changes', () => {
		darkQuery.matches = true;
		lightQuery.matches = false;
		const colorScheme = usePreferredColorScheme();
		expect(colorScheme.scheme.value).toBe('dark');

		darkQuery.matches = false;
		lightQuery.matches = true;
		darkQuery.dispatchEvent(new Event('change'));

		expect(colorScheme.scheme.value).toBe('light');
		expect(colorScheme.isDark.value).toBe(false);
	});

	it('keeps no-preference distinct from light', () => {
		lightQuery.matches = false;
		const colorScheme = usePreferredColorScheme();

		expect(colorScheme.scheme.value).toBe('no-preference');
		expect(colorScheme.hasPreference.value).toBe(false);
		expect(colorScheme.isSupported.value).toBe(true);
	});

	it('reports missing media-query support', () => {
		vi.stubGlobal('window', {});
		const colorScheme = usePreferredColorScheme();

		expect(colorScheme.scheme.value).toBe('unknown');
		expect(colorScheme.isSupported.value).toBe(false);
		expect(colorScheme.error.value).toBeNull();
	});

	it('captures setup failures as typed state', () => {
		const cause = new Error('invalid environment');
		vi.stubGlobal('window', {
			matchMedia: () => {
				throw cause;
			},
		});
		const colorScheme = usePreferredColorScheme();

		expect(colorScheme.scheme.value).toBe('unknown');
		expect(colorScheme.error.value).toMatchObject({
			name: 'PreferredColorSchemeError',
			code: 'LISTENER_FAILED',
			cause,
		});
	});

	it('uses an explicit SSR assumption without browser work', () => {
		vi.stubGlobal('window', undefined);
		vi.stubGlobal('document', undefined);
		const colorScheme = usePreferredColorScheme({ ssrScheme: 'dark' });

		expect(colorScheme.scheme.value).toBe('dark');
		expect(colorScheme.isDark.value).toBe(true);
		expect(colorScheme.isSupported.value).toBe(false);
	});
});
