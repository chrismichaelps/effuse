import { describe, it, expect, vi } from 'vitest';
import { Effect, Exit, Cause, Option, Layer } from 'effect';
import {
	buildAllLayersEffect,
	buildLayerEffect,
} from '../../layers/internal/builder.js';
import {
	defineLayer,
	resolveLayerDefinitions,
} from '../../layers/api/defineLayer.js';
import { PropsService } from '../../layers/services/PropsService.js';
import { RegistryService } from '../../layers/services/RegistryService.js';
import { TracingServiceLive } from '../../layers/tracing/index.js';
import {
	DependencyNotFoundError,
	LayerSetupError,
} from '../../layers/errors.js';
import type {
	AnyResolvedLayer,
	LayerServiceFactoryContext,
} from '../../layers/types.js';

const testLayer = Layer.mergeAll(
	PropsService.Default,
	RegistryService.Default,
	TracingServiceLive({})
);

const runTest = <A, E>(effect: Effect.Effect<A, E, never>) =>
	Effect.runPromiseExit(effect);

describe('buildLayerEffect', () => {
	it('fails malformed topology instead of blocking on a missing dependency', async () => {
		const layer: AnyResolvedLayer = {
			name: 'blocked',
			dependencies: ['missing'],
			_resolved: true,
			_order: 0,
		} as AnyResolvedLayer;

		const result = await runTest(
			Effect.provide(buildAllLayersEffect([layer]), testLayer)
		);

		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			const error = Cause.failureOption(result.cause);
			expect(Option.isSome(error)).toBe(true);
			if (Option.isSome(error)) {
				expect(error.value).toBeInstanceOf(DependencyNotFoundError);
				expect(error.value).toMatchObject({
					layerName: 'blocked',
					dependencyName: 'missing',
				});
			}
		}
	});

	it('awaits every cleanup in reverse order and preserves failures', async () => {
		const calls: string[] = [];
		const onError = vi.fn();
		const layer: AnyResolvedLayer = {
			name: 'cleanup-contract',
			setup: () => async () => {
				await Promise.resolve();
				calls.push('setup');
				throw new Error('setup cleanup failed');
			},
			onUnmount: async () => {
				await Promise.resolve();
				calls.push('unmount');
				throw new Error('unmount failed');
			},
			onError,
		} as unknown as AnyResolvedLayer;
		const result = await Effect.runPromise(
			Effect.provide(buildLayerEffect(layer, [layer]), testLayer)
		);

		await expect(result.cleanup?.()).rejects.toMatchObject({
			name: 'AggregateError',
			errors: [expect.any(Error), expect.any(Error)],
		});
		expect(calls).toEqual(['unmount', 'setup']);
		expect(onError).toHaveBeenCalledTimes(2);
	});

	it('should fail with LayerSetupError when onMount throws', async () => {
		const layer: AnyResolvedLayer = {
			name: 'failing-mount',
			onMount: () => {
				throw new Error('mount boom');
			},
		} as unknown as AnyResolvedLayer;

		const result = await runTest(
			Effect.provide(buildLayerEffect(layer, []), testLayer)
		);

		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			const errorOpt = Cause.failureOption(result.cause);
			expect(Option.isSome(errorOpt)).toBe(true);
			if (Option.isSome(errorOpt)) {
				expect(errorOpt.value).toBeInstanceOf(LayerSetupError);
				expect((errorOpt.value as LayerSetupError).layerName).toBe(
					'failing-mount'
				);
				expect((errorOpt.value as LayerSetupError).phase).toBe('onMount');
			}
		}
	});

	it('should fail with LayerSetupError when setup throws', async () => {
		const layer: AnyResolvedLayer = {
			name: 'failing-setup',
			setup: () => {
				throw new Error('setup boom');
			},
		} as unknown as AnyResolvedLayer;

		const result = await runTest(
			Effect.provide(buildLayerEffect(layer, []), testLayer)
		);

		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			const errorOpt = Cause.failureOption(result.cause);
			expect(Option.isSome(errorOpt)).toBe(true);
			if (Option.isSome(errorOpt)) {
				expect(errorOpt.value).toBeInstanceOf(LayerSetupError);
				expect((errorOpt.value as LayerSetupError).layerName).toBe(
					'failing-setup'
				);
				expect((errorOpt.value as LayerSetupError).phase).toBe('setup');
			}
		}
	});

	it('should let service factories read dependency services', async () => {
		const authLayer: AnyResolvedLayer = {
			name: 'auth',
			provides: {
				auth: () => ({ userId: 'u1' }),
			},
			_resolved: true,
			_order: 0,
		} as unknown as AnyResolvedLayer;
		const commerceLayer: AnyResolvedLayer = {
			name: 'commerce',
			dependencies: ['auth'],
			provides: {
				commerce: ({ requireService }: LayerServiceFactoryContext) => {
					const auth = requireService<{ readonly userId: string }>('auth');
					return {
						checkoutUser: () => auth.userId,
					};
				},
			},
			_resolved: true,
			_order: 1,
		} as unknown as AnyResolvedLayer;

		const result = await Effect.runPromise(
			Effect.provide(
				Effect.gen(function* () {
					yield* buildAllLayersEffect([authLayer, commerceLayer]);
					const registry = yield* RegistryService;
					return registry.getService('commerce') as {
						checkoutUser: () => string;
					};
				}),
				testLayer
			)
		);

		expect(result.checkoutUser()).toBe('u1');
	});

	it('should treat extended layers as service factory dependencies', async () => {
		const AuthLayer = defineLayer({
			name: 'auth',
			services: {
				auth: () => ({ userId: 'u1' }),
			},
		});
		const CommerceLayer = defineLayer('commerce', ({ service }) => ({
			extends: [AuthLayer],
			services: {
				commerce: service(({ deps, requireService }) => {
					const auth = requireService<{ readonly userId: string }>('auth');
					return {
						dependencyName: () => deps.auth.name,
						checkoutUser: () => auth.userId,
					};
				}),
			},
		}));
		const layers = resolveLayerDefinitions([CommerceLayer]);

		const result = await Effect.runPromise(
			Effect.provide(
				Effect.gen(function* () {
					yield* buildAllLayersEffect(layers);
					const registry = yield* RegistryService;
					return registry.getService('commerce') as {
						dependencyName: () => string;
						checkoutUser: () => string;
					};
				}),
				testLayer
			)
		);

		expect(layers.map((layer) => layer.name)).toEqual(['auth', 'commerce']);
		expect(result.dependencyName()).toBe('auth');
		expect(result.checkoutUser()).toBe('u1');
	});

	it('should fail service factories with LayerSetupError when required service is missing', async () => {
		const layer: AnyResolvedLayer = {
			name: 'commerce',
			provides: {
				commerce: ({ requireService }: LayerServiceFactoryContext) => {
					requireService('missing-auth');
					return {};
				},
			},
			_resolved: true,
			_order: 0,
		} as unknown as AnyResolvedLayer;

		const result = await runTest(
			Effect.provide(buildLayerEffect(layer, [layer]), testLayer)
		);

		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			const errorOpt = Cause.failureOption(result.cause);
			expect(Option.isSome(errorOpt)).toBe(true);
			if (Option.isSome(errorOpt)) {
				expect(errorOpt.value).toBeInstanceOf(LayerSetupError);
				expect((errorOpt.value as LayerSetupError).layerName).toBe('commerce');
				expect((errorOpt.value as LayerSetupError).phase).toBe(
					'service:commerce'
				);
			}
		}
	});

	it('preserves setup and rollback failures when layer initialization aborts', async () => {
		const setupFailure = new Error('setup failed');
		const rollbackFailure = new Error('rollback failed');
		const InitializedLayer = defineLayer({
			name: 'rollback-source',
			setup: () => () => {
				throw rollbackFailure;
			},
		});
		const FailingLayer = defineLayer({
			name: 'rollback-target',
			dependencies: ['rollback-source'] as const,
			setup: () => {
				throw setupFailure;
			},
		});

		const result = await runTest(
			Effect.provide(
				buildAllLayersEffect(
					resolveLayerDefinitions([InitializedLayer, FailingLayer])
				),
				testLayer
			)
		);

		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			const errorOption = Cause.failureOption(result.cause);
			expect(Option.isSome(errorOption)).toBe(true);
			if (Option.isSome(errorOption)) {
				const aggregate = errorOption.value as AggregateError;
				expect(aggregate).toBeInstanceOf(AggregateError);
				expect(aggregate.message).toBe(
					'[Effuse] Layer initialization failed with 1 setup and 1 rollback errors.'
				);
				expect(aggregate.errors).toHaveLength(2);
				expect(aggregate.errors[0]).toMatchObject({
					cause: setupFailure,
					layerName: 'rollback-target',
					phase: 'setup',
				});
				expect(aggregate.errors[1]).toBe(rollbackFailure);
			}
		}
	});

	it('preserves every failure from a parallel topology level', async () => {
		const FirstLayer = defineLayer({
			name: 'parallel-first',
			setup: () => {
				throw new Error('first failed');
			},
		});
		const SecondLayer = defineLayer({
			name: 'parallel-second',
			setup: () => {
				throw new Error('second failed');
			},
		});

		const result = await runTest(
			Effect.provide(
				buildAllLayersEffect(
					resolveLayerDefinitions([FirstLayer, SecondLayer])
				),
				testLayer
			)
		);

		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			const errorOption = Cause.failureOption(result.cause);
			expect(Option.isSome(errorOption)).toBe(true);
			if (Option.isSome(errorOption)) {
				const aggregate = errorOption.value as AggregateError;
				expect(aggregate).toBeInstanceOf(AggregateError);
				expect(aggregate.message).toBe(
					'[Effuse] Layer initialization failed with 2 setup and 0 rollback errors.'
				);
				expect(aggregate.errors).toHaveLength(2);
				expect(aggregate.errors[0]).toMatchObject({
					layerName: 'parallel-first',
					phase: 'setup',
				});
				expect(aggregate.errors[1]).toMatchObject({
					layerName: 'parallel-second',
					phase: 'setup',
				});
			}
		}
	});
});
