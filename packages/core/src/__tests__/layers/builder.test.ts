import { describe, it, expect } from 'vitest';
import { Effect, Exit, Cause, Option, Layer } from 'effect';
import {
	buildAllLayersEffect,
	buildLayerEffect,
} from '../../layers/internal/builder.js';
import { PropsService } from '../../layers/services/PropsService.js';
import { RegistryService } from '../../layers/services/RegistryService.js';
import { TracingServiceLive } from '../../layers/tracing/index.js';
import { LayerSetupError } from '../../layers/errors.js';
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
				expect((errorOpt.value as LayerSetupError).layerName).toBe('failing-mount');
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
				expect((errorOpt.value as LayerSetupError).layerName).toBe('failing-setup');
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
});
