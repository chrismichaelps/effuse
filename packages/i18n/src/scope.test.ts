import { describe, it, expect, afterEach } from 'vitest';
import {
	createI18n,
	createI18nInstance,
	getI18n,
	withI18n,
	resolveLocale,
	resetI18n,
	t,
} from './index.js';
import { I18nNotInitializedError } from './errors/index.js';

const translations = {
	en: { greeting: 'Hello' },
	es: { greeting: 'Hola' },
	de: { greeting: 'Hallo' },
};

afterEach(() => {
	resetI18n();
});

describe('createI18nInstance', () => {
	it('should create an instance without registering it globally', () => {
		const instance = createI18nInstance({
			defaultLocale: 'es',
			translations,
		});

		expect(instance.t('greeting')).toBe('Hola');
		expect(() => getI18n()).toThrow(I18nNotInitializedError);
	});

	it('should not overwrite an existing global instance', () => {
		createI18n({ defaultLocale: 'en', translations });
		createI18nInstance({ defaultLocale: 'de', translations });

		expect(getI18n().getLocale()).toBe('en');
	});
});

describe('withI18n', () => {
	it('should resolve getI18n and t against the scoped instance', () => {
		const scoped = createI18nInstance({
			defaultLocale: 'es',
			translations,
		});

		const result = withI18n(scoped, () => ({
			viaGet: getI18n().t('greeting'),
			viaT: t('greeting'),
		}));

		expect(result.viaGet).toBe('Hola');
		expect(result.viaT).toBe('Hola');
	});

	it('should fall back to the global instance outside the scope', () => {
		createI18n({ defaultLocale: 'en', translations });
		const scoped = createI18nInstance({
			defaultLocale: 'de',
			translations,
		});

		expect(withI18n(scoped, () => t('greeting'))).toBe('Hallo');
		expect(t('greeting')).toBe('Hello');
	});

	it('should isolate interleaved scoped renders', () => {
		const english = createI18nInstance({
			defaultLocale: 'en',
			translations,
		});
		const spanish = createI18nInstance({
			defaultLocale: 'es',
			translations,
		});

		const first = withI18n(english, () => t('greeting'));
		const second = withI18n(spanish, () => t('greeting'));
		const third = withI18n(english, () =>
			withI18n(spanish, () => t('greeting'))
		);
		const fourth = withI18n(english, () => {
			withI18n(spanish, () => t('greeting'));
			return t('greeting');
		});

		expect(first).toBe('Hello');
		expect(second).toBe('Hola');
		expect(third).toBe('Hola');
		expect(fourth).toBe('Hello');
	});

	it('should restore the outer scope when the callback throws', () => {
		const english = createI18nInstance({
			defaultLocale: 'en',
			translations,
		});
		const spanish = createI18nInstance({
			defaultLocale: 'es',
			translations,
		});

		withI18n(english, () => {
			expect(() =>
				withI18n(spanish, () => {
					throw new Error('render failed');
				})
			).toThrow('render failed');

			expect(t('greeting')).toBe('Hello');
		});
	});

	it('should still throw when nothing is bound or registered', () => {
		expect(() => t('greeting')).toThrow(I18nNotInitializedError);
	});
});

describe('resolveLocale', () => {
	const available = ['en', 'es', 'de'];

	it('should pick the highest-quality available locale', () => {
		expect(
			resolveLocale('es;q=0.9, de;q=1.0, fr;q=0.8', available, 'en')
		).toBe('de');
	});

	it('should match region tags to their base locale', () => {
		expect(resolveLocale('en-US,en;q=0.9', available, 'de')).toBe('en');
		expect(resolveLocale('es-MX', available, 'en')).toBe('es');
	});

	it('should fall back when nothing matches', () => {
		expect(resolveLocale('fr-FR,it;q=0.8', available, 'en')).toBe('en');
		expect(resolveLocale('', available, 'de')).toBe('de');
		expect(resolveLocale(null, available, 'es')).toBe('es');
	});

	it('should honor the wildcard by using the fallback', () => {
		expect(resolveLocale('*', available, 'es')).toBe('es');
	});

	it('should ignore malformed quality values', () => {
		expect(resolveLocale('de;q=broken, es;q=0.5', available, 'en')).toBe(
			'de'
		);
	});
});
