import { describe, expect, it } from 'vitest';
import { appendAuthCookies } from '../server/index.js';

describe('appendAuthCookies', () => {
	it('preserves the response while appending every auth cookie', async () => {
		const response = appendAuthCookies(
			new Response('signed in', {
				status: 201,
				statusText: 'Created',
				headers: { 'x-request-id': 'req_1' },
			}),
			['session.0=first; Path=/', 'session.1=second; Path=/']
		);

		expect(response.status).toBe(201);
		expect(response.statusText).toBe('Created');
		expect(response.headers.get('x-request-id')).toBe('req_1');
		expect(response.headers.getSetCookie()).toEqual([
			'session.0=first; Path=/',
			'session.1=second; Path=/',
		]);
		expect(await response.text()).toBe('signed in');
	});

	it('returns the original response when no cookies need propagation', () => {
		const response = new Response(null, { status: 204 });

		expect(appendAuthCookies(response, [])).toBe(response);
	});
});
