import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	RenderError,
	createErrorDiagnostic,
	createErrorHtml,
} from '../../ssr/errors.js';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('SSR error diagnostics', () => {
	it('serializes native Error causes with their useful fields', () => {
		const cause = new Error('database unavailable');
		const error = new RenderError({
			message: 'Render failed',
			url: '/account',
			cause,
		});

		expect(createErrorDiagnostic(error)).toMatchObject({
			_tag: 'RenderError',
			message: 'Render failed',
			url: '/account',
			cause: {
				name: 'Error',
				message: 'database unavailable',
				stack: expect.stringContaining('database unavailable'),
			},
		});
	});

	it('handles nested and circular causes without throwing', () => {
		const cause: { label: string; self?: unknown } = { label: 'cycle' };
		cause.self = cause;
		const error = new RenderError({ message: 'Failed', url: '/', cause });

		expect(createErrorDiagnostic(error)).toMatchObject({
			cause: { label: 'cycle', self: '[Circular]' },
		});
	});

	it('escapes development diagnostics before embedding them in HTML', () => {
		vi.stubEnv('NODE_ENV', 'development');
		const error = new RenderError({
			message: '<script>alert("message")</script>',
			url: '/',
			cause: new Error('<script>alert("cause")</script>'),
		});

		const html = createErrorHtml(error);

		expect(html).toContain('&lt;script&gt;alert("message")&lt;/script&gt;');
		expect(html).toContain('&lt;script&gt;alert(\\"cause\\")&lt;/script&gt;');
		expect(html).not.toContain('<script>alert');
	});

	it('does not expose diagnostics in production', () => {
		vi.stubEnv('NODE_ENV', 'production');
		const error = new RenderError({
			message: 'secret render detail',
			url: '/',
			cause: new Error('secret cause'),
		});

		const html = createErrorHtml(error);

		expect(html).toContain('Something went wrong');
		expect(html).not.toContain('secret render detail');
		expect(html).not.toContain('secret cause');
	});
});
