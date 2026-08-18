import { describe, it, expect } from 'vitest';
import { serializeHydrationData, getHydrationData } from '../../ssr/hydration.js';

describe('serializeHydrationData', () => {
	it('should escape </script to prevent HTML break-out', () => {
		const data = {
			head: {},
			state: { evil: '</script><script>alert("xss")</script>' },
			url: '/',
		};

		const html = serializeHydrationData(data);
		// Extract JSON payload inside the script tag
		const match = html.match(/<script[^>]*>(.*?)<\/script>/s);
		expect(match).toBeTruthy();
		const json = match![1];
		expect(json).not.toContain('</script>');
		expect(json).toContain('\\u003c/script');
	});

	it('should escape <!-- to prevent comment injection', () => {
		const data = {
			head: {},
			state: { evil: '<!-- bad -->' },
			url: '/',
		};

		const html = serializeHydrationData(data);
		const match = html.match(/<script[^>]*>(.*?)<\/script>/s);
		expect(match).toBeTruthy();
		const json = match![1];
		expect(json).not.toContain('<!--');
		expect(json).toContain('\\u003c!--');
	});

	it('should escape <!CDATA[ to prevent CDATA injection', () => {
		const data = {
			head: {},
			state: { evil: '<!CDATA[ something ]]>' },
			url: '/',
		};

		const html = serializeHydrationData(data);
		const match = html.match(/<script[^>]*>(.*?)<\/script>/s);
		expect(match).toBeTruthy();
		const json = match![1];
		expect(json).not.toContain('<!CDATA[');
		expect(json).toContain('\\u003c!CDATA[');
	});

	it('should escape any < character comprehensively', () => {
		const data = {
			head: {},
			state: { evil: '<svg onload=alert(1)>' },
			url: '/',
		};

		const html = serializeHydrationData(data);
		const match = html.match(/<script[^>]*>(.*?)<\/script>/s);
		expect(match).toBeTruthy();
		const json = match![1];
		expect(json).not.toContain('<svg');
		expect(json).toContain('\\u003csvg');
	});

	it('should produce parseable JSON after unescaping', () => {
		const data = {
			head: { title: 'Test' },
			state: { foo: 'bar', num: 42 },
			url: '/test',
		};

		const html = serializeHydrationData(data);
		// Extract JSON from script tag
		const match = html.match(/<script[^>]*>(.*?)<\/script>/s);
		expect(match).toBeTruthy();
		const escaped = match![1];
		// Reverse the escaping
		const json = escaped.replace(/\\u003c/g, '<');
		const parsed = JSON.parse(json);
		expect(parsed).toEqual(data);
	});
});

describe('getHydrationData', () => {
	it('should return null when document is undefined', () => {
		expect(getHydrationData()).toBeNull();
	});
});
