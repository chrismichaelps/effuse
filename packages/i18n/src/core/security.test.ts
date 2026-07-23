import { describe, it, expect } from 'vitest';
import { mergeTranslations, getNestedValue } from './translator.js';

describe('i18n prototype-pollution hardening', () => {
	it('should not reparent the merged object via a __proto__ key', () => {
		const malicious = JSON.parse('{"__proto__": {"polluted": "yes"}}');
		const merged = mergeTranslations({ greeting: 'hi' }, malicious);

		expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
		expect(
			(Object.prototype as Record<string, unknown>)['polluted']
		).toBeUndefined();
		expect((merged as Record<string, unknown>)['polluted']).toBeUndefined();
	});

	it('should not merge constructor or prototype keys', () => {
		const malicious = JSON.parse(
			'{"constructor": {"evil": "1"}, "prototype": {"evil": "2"}}'
		);
		const merged = mergeTranslations({ greeting: 'hi' }, malicious);

		expect(merged.greeting).toBe('hi');
		expect(Object.prototype.hasOwnProperty.call(merged, 'constructor')).toBe(
			false
		);
		expect(({} as Record<string, unknown>)['evil']).toBeUndefined();
	});

	it('should preserve legitimate nested keys during merge', () => {
		const merged = mergeTranslations(
			{ nav: { home: 'Home' } },
			{ nav: { about: 'About' } }
		);

		expect(merged).toEqual({ nav: { home: 'Home', about: 'About' } });
	});

	it('should not resolve inherited properties in getNestedValue', () => {
		const translations = JSON.parse('{"a": {"b": "value"}}');

		expect(getNestedValue(translations, 'a.b')).toBe('value');
		expect(getNestedValue(translations, 'constructor')).toBeUndefined();
		expect(getNestedValue(translations, 'a.__proto__.polluted')).toBeUndefined();
		expect(getNestedValue(translations, 'a.constructor.name')).toBeUndefined();
		expect(getNestedValue(translations, 'toString')).toBeUndefined();
	});
});
