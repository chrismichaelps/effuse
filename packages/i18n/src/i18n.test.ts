import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createI18n,
	getI18n,
	resetI18n,
	t,
	setLocale,
	getLocale,
	useTranslation,
	type I18n,
} from './index.js';

interface StrictTranslations {
	nav: {
		home: string;
		docs: string;
		about: string;
	};
	common: {
		greeting: string;
		farewell: string;
	};
	messages: {
		welcome: string;
		error: string;
	};
}

const enTranslations: StrictTranslations = {
	nav: { home: 'Home', docs: 'Documentation', about: 'About Us' },
	common: { greeting: 'Hello', farewell: 'Goodbye' },
	messages: { welcome: 'Welcome, {{name}}!', error: 'An error occurred' },
};

const esTranslations: StrictTranslations = {
	nav: { home: 'Inicio', docs: 'Documentación', about: 'Sobre Nosotros' },
	common: { greeting: 'Hola', farewell: 'Adiós' },
	messages: { welcome: '¡Bienvenido, {{name}}!', error: 'Ocurrió un error' },
};

describe('I18n', () => {
	beforeEach(() => {
		resetI18n();
	});

	describe('createI18n', () => {
		it('should create an untyped i18n instance', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: { en: { hello: 'Hello' } },
			});

			expect(i18n).toBeDefined();
			expect(i18n.t('hello')).toBe('Hello');
		});

		it('should create a typed i18n instance with strict interface', () => {
			const i18n = createI18n<StrictTranslations>({
				defaultLocale: 'en',
				translations: { en: enTranslations },
			});

			expect(i18n.t('nav.home')).toBe('Home');
			expect(i18n.t('common.greeting')).toBe('Hello');
		});

		it('should use default locale when not specified', () => {
			const i18n = createI18n({
				translations: { en: { test: 'Test' } },
			});

			expect(i18n.getLocale()).toBe('en');
		});

		it('should support multiple locales', () => {
			const i18n = createI18n<StrictTranslations>({
				defaultLocale: 'en',
				translations: { en: enTranslations, es: esTranslations },
			});

			expect(i18n.t('nav.home')).toBe('Home');
		});
	});

	describe('t() translation function', () => {
		beforeEach(() => {
			createI18n<StrictTranslations>({
				defaultLocale: 'en',
				translations: { en: enTranslations, es: esTranslations },
			});
		});

		it('should translate simple keys', () => {
			expect((t as (key: string) => string)('nav.home')).toBe('Home');
			expect(t('nav.docs')).toBe('Documentation');
		});

		it('should translate nested keys', () => {
			expect(t('common.greeting')).toBe('Hello');
			expect(t('messages.error')).toBe('An error occurred');
		});

		it('should interpolate variables', () => {
			const result = t('messages.welcome', { name: 'John' });
			expect(result).toBe('Welcome, John!');
		});

		it('should return key when translation not found', () => {
			expect(t('nonexistent.key')).toBe('nonexistent.key');
		});
	});

	describe('setLocale / getLocale', () => {
		beforeEach(() => {
			createI18n<StrictTranslations>({
				defaultLocale: 'en',
				translations: { en: enTranslations, es: esTranslations },
			});
		});

		it('should return current locale', () => {
			expect(getLocale()).toBe('en');
		});

		it('should change locale', async () => {
			await setLocale('es');
			expect(getLocale()).toBe('es');
		});

		it('should translate in new locale after change', async () => {
			await setLocale('es');
			expect(t('nav.home')).toBe('Inicio');
			expect(t('common.greeting')).toBe('Hola');
		});
	});

	describe('getI18n', () => {
		it('should throw when i18n not initialized', () => {
			expect(() => getI18n()).toThrow();
		});

		it('should return global instance after createI18n', () => {
			createI18n({ translations: { en: { test: 'Test' } } });
			const i18n = getI18n();
			expect(i18n).toBeDefined();
			expect(i18n.t('test')).toBe('Test');
		});

		it('should return typed instance when generic specified', () => {
			createI18n<StrictTranslations>({
				defaultLocale: 'en',
				translations: { en: enTranslations },
			});

			const i18n = getI18n<StrictTranslations>();
			expect(i18n.t('nav.home')).toBe('Home');
		});
	});

	describe('useTranslation hook', () => {
		beforeEach(() => {
			createI18n<StrictTranslations>({
				defaultLocale: 'en',
				translations: { en: enTranslations },
			});
		});

		it('should return translation utilities', () => {
			const { t, locale, setLocale, hasKey } = useTranslation();

			expect(typeof t).toBe('function');
			expect(locale).toBeDefined();
			expect(typeof setLocale).toBe('function');
			expect(typeof hasKey).toBe('function');
		});

		it('should translate using returned t function', () => {
			const { t } = useTranslation();
			expect(t('nav.home')).toBe('Home');
		});
	});

	describe('hasKey', () => {
		beforeEach(() => {
			createI18n<StrictTranslations>({
				defaultLocale: 'en',
				translations: { en: enTranslations },
			});
		});

		it('should return true for existing keys', () => {
			const i18n = getI18n();
			expect(i18n.hasKey('nav.home')).toBe(true);
			expect(i18n.hasKey('common.greeting')).toBe(true);
		});

		it('should return false for non-existing keys', () => {
			const i18n = getI18n();
			expect(i18n.hasKey('nonexistent')).toBe(false);
			expect(i18n.hasKey('nav.invalid')).toBe(false);
		});
	});

	describe('getAvailableLocales', () => {
		it('should return all registered locales', () => {
			createI18n({
				defaultLocale: 'en',
				translations: {
					en: { test: 'Test' },
					es: { test: 'Prueba' },
					fr: { test: 'Tester' },
				},
			});

			const locales = getI18n().getAvailableLocales();
			expect(locales).toContain('en');
			expect(locales).toContain('es');
			expect(locales).toContain('fr');
			expect(locales).toHaveLength(3);
		});
	});

	describe('addTranslations', () => {
		it('should add translations for new locale', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: { en: { hello: 'Hello' } },
			});

			i18n.addTranslations('de', { hello: 'Hallo' });

			expect(i18n.getAvailableLocales()).toContain('de');
		});

		it('should merge translations for existing locale', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: { en: { hello: 'Hello' } },
			});

			i18n.addTranslations('en', { goodbye: 'Goodbye' });

			expect(i18n.t('hello')).toBe('Hello');
			expect((i18n as I18n).t('goodbye')).toBe('Goodbye');
		});
	});

	describe('Fallback Locale', () => {
		it('should fallback to fallbackLocale when key missing', () => {
			const i18n = createI18n({
				defaultLocale: 'es',
				fallbackLocale: 'en',
				translations: {
					en: { hello: 'Hello', only_en: 'Only English' },
					es: { hello: 'Hola' },
				},
			});

			expect(i18n.t('only_en')).toBe('Only English');
		});
	});

	describe('onMissingKey callback', () => {
		it('should call onMissingKey when translation not found', () => {
			const onMissingKey = vi.fn(() => 'MISSING');

			const i18n = createI18n({
				defaultLocale: 'en',
				translations: { en: { hello: 'Hello' } },
				onMissingKey,
			});

			const result = (i18n as I18n).t('nonexistent');

			expect(onMissingKey).toHaveBeenCalledWith('nonexistent', 'en');
			expect(result).toBe('MISSING');
		});

		it('should return key if onMissingKey returns undefined', () => {
			const onMissingKey = vi.fn(() => undefined);

			const i18n = createI18n({
				defaultLocale: 'en',
				translations: { en: { hello: 'Hello' } },
				onMissingKey,
			});

			const result = (i18n as I18n).t('nonexistent');

			expect(result).toBe('nonexistent');
		});
	});

	describe('Locale Signal', () => {
		it('should expose locale as reactive signal', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: { en: { test: 'Test' } },
			});

			expect(i18n.locale.value).toBe('en');
		});

		it('should update signal when locale changes', async () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: { en: { test: 'Test' }, es: { test: 'Prueba' } },
			});

			await i18n.setLocale('es');

			expect(i18n.locale.value).toBe('es');
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty translations object', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: { en: {} },
			});

			expect((i18n as I18n).t('any.key')).toBe('any.key');
		});

		it('should handle deeply nested translations', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: {
					en: {
						level1: {
							level2: {
								level3: {
									value: 'Deep Value',
								},
							},
						},
					},
				},
			});

			expect(i18n.t('level1.level2.level3.value')).toBe('Deep Value');
		});

		it('should handle multiple interpolation variables', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: {
					en: { message: '{{greeting}}, {{name}}! Today is {{day}}.' },
				},
			});

			const result = i18n.t('message', {
				greeting: 'Hello',
				name: 'World',
				day: 'Monday',
			});

			expect(result).toBe('Hello, World! Today is Monday.');
		});

		it('should handle numeric interpolation values', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: {
					en: { items: 'You have {{count}} items' },
				},
			});

			const result = i18n.t('items', { count: 42 });

			expect(result).toBe('You have 42 items');
		});

		it('should handle special characters in translations', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: {
					en: { special: 'Price: $100 & Tax: 10%' },
				},
			});

			expect(i18n.t('special')).toBe('Price: $100 & Tax: 10%');
		});

		it('should handle unicode characters', () => {
			const i18n = createI18n({
				defaultLocale: 'ja',
				translations: {
					ja: { greeting: 'こんにちは' },
				},
			});

			expect(i18n.t('greeting')).toBe('こんにちは');
		});

		it('should handle emoji in translations', () => {
			const i18n = createI18n({
				defaultLocale: 'en',
				translations: {
					en: { success: '✅ Success!' },
				},
			});

			expect(i18n.t('success')).toBe('✅ Success!');
		});
	});

	describe('TranslationShape - Strict Interface Support', () => {
		it('should accept strict interface without index signature', () => {
			interface AppTranslations {
				nav: { home: string; docs: string };
				sidebar: { title: string };
			}

			const i18n = createI18n<AppTranslations>({
				defaultLocale: 'en',
				translations: {
					en: {
						nav: { home: 'Home', docs: 'Docs' },
						sidebar: { title: 'Menu' },
					},
				},
			});

			expect(i18n.t('nav.home')).toBe('Home');
			expect(i18n.t('sidebar.title')).toBe('Menu');
		});

		it('should provide type-safe key access', () => {
			const i18n = createI18n<StrictTranslations>({
				defaultLocale: 'en',
				translations: { en: enTranslations },
			});

			expect(i18n.t('nav.home')).toBe('Home');
			expect(i18n.t('nav.docs')).toBe('Documentation');
			expect(i18n.t('nav.about')).toBe('About Us');
		});
	});

	describe('resetI18n', () => {
		it('should reset global instance', () => {
			createI18n({ translations: { en: { test: 'Test' } } });
			expect(() => getI18n()).not.toThrow();

			resetI18n();

			expect(() => getI18n()).toThrow();
		});

		it('should allow creating new instance after reset', () => {
			createI18n({ translations: { en: { first: 'First' } } });
			resetI18n();

			createI18n({ translations: { en: { second: 'Second' } } });

			expect(t('second')).toBe('Second');
			expect(t('first')).toBe('first');
		});
	});
});
