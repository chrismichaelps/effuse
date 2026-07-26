import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { ServerLayerContext } from '../../layers/types.js';
import {
	defineServerMiddleware,
	type ServerMiddlewareMethod,
	type ServerMiddlewareTarget,
	type ServerRequestMiddlewareContext,
	type ServerRouteMiddlewareDefinition,
} from '../../ssr/middleware-definition.js';

describe('defineServerMiddleware', () => {
	it('normalizes secure route defaults without wrapping the handler', () => {
		const handler = vi.fn(async () => new Response('ok'));
		const definition = defineServerMiddleware({ handler });

		expect(definition).toEqual({
			phase: 'route',
			order: 0,
			match: {
				paths: ['/*'],
				methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
				targets: ['api', 'action', 'page'],
			},
			handler,
		});
		expect(definition.handler).toBe(handler);
		expect(definition.match.targets).not.toContain('asset');
		expect(Object.isFrozen(definition)).toBe(true);
		expect(Object.isFrozen(definition.match)).toBe(true);
		expect(Object.isFrozen(definition.match.paths)).toBe(true);
	});

	it('infers request context, replacement requests, and literal match metadata', () => {
		const definition = defineServerMiddleware({
			phase: 'request',
			name: 'admin-auth',
			order: 100,
			match: {
				paths: '/api/admin/[...path]',
				methods: ['get', 'POST'] as const,
				targets: 'api',
			},
			handler: (context, next) => {
				expectTypeOf(context).toEqualTypeOf<ServerRequestMiddlewareContext>();
				expectTypeOf(next).parameter(0).toEqualTypeOf<Request | undefined>();
				// @ts-expect-error Params do not exist before route matching.
				void context.params;
				// @ts-expect-error Services do not exist before layer selection.
				void context.services;
				return next(new Request(context.request));
			},
		});

		expectTypeOf(definition.phase).toEqualTypeOf<'request'>();
		expectTypeOf(definition.match.paths).toEqualTypeOf<
			readonly ['/api/admin/[...path]']
		>();
		expectTypeOf(definition.match.methods).toEqualTypeOf<
			readonly ['GET', 'POST']
		>();
		expect(definition).toMatchObject({
			name: 'admin-auth',
			order: 100,
			match: {
				paths: ['/api/admin/[...path]'],
				methods: ['GET', 'POST'],
				targets: ['api'],
			},
		});
	});

	it('retains the established route context and service typing', () => {
		type Services = Record<string, unknown> & {
			auth: { readonly userId: string };
		};
		const definition = defineServerMiddleware<Services>({
			phase: 'route',
			handler: (context, next) => {
				expectTypeOf(context).toEqualTypeOf<ServerLayerContext<Services>>();
				expectTypeOf(context.services.auth.userId).toEqualTypeOf<string>();
				return next();
			},
		});

		expectTypeOf(definition.phase).toEqualTypeOf<'route'>();
	});

	it('snapshots mutable matcher inputs', () => {
		const paths = ['/api/users/[id]'];
		const methods: ServerMiddlewareMethod[] = ['get'];
		const targets: ServerMiddlewareTarget[] = ['api'];
		const definition = defineServerMiddleware({
			match: { paths, methods, targets },
			handler: async () => new Response('ok'),
		});
		paths[0] = '/api/mutated';
		methods.push('POST');
		targets.push('page');

		expect(definition.match).toEqual({
			paths: ['/api/users/[id]'],
			methods: ['GET'],
			targets: ['api'],
		});
	});

	it.each([
		['relative path', { match: { paths: 'api/users' } }],
		['malformed path', { match: { paths: '/api/[...]' } }],
		[
			'duplicate path shape',
			{ match: { paths: ['/api/[id]', '/(group)/api/[name]'] } },
		],
		['empty paths', { match: { paths: [] } }],
		['duplicate methods', { match: { methods: ['GET', 'get'] } }],
		['invalid method', { match: { methods: ['TRACE'] } }],
		['empty methods', { match: { methods: [] } }],
		['duplicate targets', { match: { targets: ['api', 'api'] } }],
		['invalid target', { match: { targets: ['socket'] } }],
		['empty targets', { match: { targets: [] } }],
		['fractional order', { order: 1.5 }],
		['unsafe order', { order: Number.POSITIVE_INFINITY }],
		['untrimmed name', { name: ' auth ' }],
		['empty name', { name: '' }],
		['non-object match', { match: '/api' }],
		['invalid phase', { phase: 'response' }],
	])('rejects %s', (_name, invalid) => {
		expect(() =>
			defineServerMiddleware({
				handler: async () => new Response('ok'),
				...invalid,
			} as ServerRouteMiddlewareDefinition)
		).toThrow(TypeError);
	});

	it('rejects a missing handler at runtime', () => {
		expect(() =>
			defineServerMiddleware({} as ServerRouteMiddlewareDefinition)
		).toThrow('handler must be a function');
	});
});
