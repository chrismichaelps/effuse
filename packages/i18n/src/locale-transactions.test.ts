import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleLoadError } from './errors/index.js';
import { createI18nInstance } from './i18n.js';
import { LOCALE_STORAGE_KEY } from './config/constants.js';
import type { Translations } from './types/index.js';

const deferred = <T>() => {
	let resolve: ((value: T) => void) | undefined;
	let reject: ((error: unknown) => void) | undefined;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return {
		promise,
		resolve: (value: T) => resolve?.(value),
		reject: (error: unknown) => reject?.(error),
	};
};

const waitForLoad = async (
	loads: Map<string, ReturnType<typeof deferred<Translations>>>,
	locale: string
) => {
	await vi.waitFor(() => {
		expect(loads.has(locale)).toBe(true);
	});
	const load = loads.get(locale);
	if (!load) throw new Error(`Loader did not start for ${locale}`);
	return load;
};

describe('i18n locale transactions', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('rejects failed loads without activating an untranslated locale', async () => {
		const i18n = createI18nInstance({
			defaultLocale: 'en',
			translations: { en: { greeting: 'Hello' } },
			loader: () => Promise.reject(new Error('translation service down')),
		});

		await expect(i18n.setLocale('fr')).rejects.toBeInstanceOf(LocaleLoadError);
		expect(i18n.getLocale()).toBe('en');
		expect(i18n.t('greeting')).toBe('Hello');
		expect(i18n.getAvailableLocales()).toEqual(['en']);
	});

	it('keeps the latest requested locale when loads resolve out of order', async () => {
		const loads = new Map<string, ReturnType<typeof deferred<Translations>>>();
		const i18n = createI18nInstance({
			defaultLocale: 'en',
			translations: { en: { language: 'English' } },
			loader: (locale) => {
				const load = deferred<Translations>();
				loads.set(locale, load);
				return load.promise;
			},
		});

		const spanish = i18n.setLocale('es');
		const french = i18n.setLocale('fr');
		const frenchLoad = await waitForLoad(loads, 'fr');
		const spanishLoad = await waitForLoad(loads, 'es');
		frenchLoad.resolve({ language: 'Français' });
		await french;
		expect(i18n.getLocale()).toBe('fr');

		spanishLoad.resolve({ language: 'Español' });
		await spanish;
		expect(i18n.getLocale()).toBe('fr');
		expect(i18n.t('language')).toBe('Français');
	});

	it('coalesces concurrent loads for the same locale', async () => {
		const load = deferred<Translations>();
		const loader = vi.fn(() => load.promise);
		const i18n = createI18nInstance({
			defaultLocale: 'en',
			translations: { en: { language: 'English' } },
			loader,
		});

		const first = i18n.setLocale('es');
		const second = i18n.setLocale('es');
		await vi.waitFor(() => {
			expect(loader).toHaveBeenCalled();
		});
		expect(loader).toHaveBeenCalledOnce();
		load.resolve({ language: 'Español' });
		await Promise.all([first, second]);

		expect(i18n.getLocale()).toBe('es');
		expect(loader).toHaveBeenCalledOnce();
	});

	it('allows a failed locale load to be retried', async () => {
		const loader = vi
			.fn<(locale: string) => Promise<Translations>>()
			.mockRejectedValueOnce(new Error('temporary outage'))
			.mockResolvedValueOnce({ language: 'Français' });
		const i18n = createI18nInstance({
			defaultLocale: 'en',
			translations: { en: { language: 'English' } },
			loader,
		});

		await expect(i18n.setLocale('fr')).rejects.toBeInstanceOf(LocaleLoadError);
		await i18n.setLocale('fr');

		expect(loader).toHaveBeenCalledTimes(2);
		expect(i18n.getLocale()).toBe('fr');
		expect(i18n.t('language')).toBe('Français');
	});

	it('surfaces a stale failure without replacing a newer locale', async () => {
		const loads = new Map<string, ReturnType<typeof deferred<Translations>>>();
		const i18n = createI18nInstance({
			defaultLocale: 'en',
			translations: { en: { language: 'English' } },
			loader: (locale) => {
				const load = deferred<Translations>();
				loads.set(locale, load);
				return load.promise;
			},
		});

		const spanish = i18n.setLocale('es');
		const french = i18n.setLocale('fr');
		const frenchLoad = await waitForLoad(loads, 'fr');
		const spanishLoad = await waitForLoad(loads, 'es');
		frenchLoad.resolve({ language: 'Français' });
		await french;
		spanishLoad.reject(new Error('Spanish unavailable'));

		await expect(spanish).rejects.toBeInstanceOf(LocaleLoadError);
		expect(i18n.getLocale()).toBe('fr');
		expect(i18n.t('language')).toBe('Français');
	});

	it('persists only the locale that wins the transition race', async () => {
		const setItem = vi.fn();
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => null),
			setItem,
		});
		const loads = new Map<string, ReturnType<typeof deferred<Translations>>>();
		const i18n = createI18nInstance({
			defaultLocale: 'en',
			persistLocale: true,
			translations: { en: { language: 'English' } },
			loader: (locale) => {
				const load = deferred<Translations>();
				loads.set(locale, load);
				return load.promise;
			},
		});

		const spanish = i18n.setLocale('es');
		const french = i18n.setLocale('fr');
		const frenchLoad = await waitForLoad(loads, 'fr');
		const spanishLoad = await waitForLoad(loads, 'es');
		frenchLoad.resolve({ language: 'Français' });
		await french;
		spanishLoad.resolve({ language: 'Español' });
		await spanish;

		expect(setItem).toHaveBeenCalledOnce();
		expect(setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'fr');
	});
});
