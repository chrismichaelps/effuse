import { describe, it, expect } from 'vitest';
import { Effect, Exit, Cause, Option, Layer } from 'effect';
import { buildLayerEffect } from '../../layers/internal/builder.js';
import { PropsService } from '../../layers/services/PropsService.js';
import { RegistryService } from '../../layers/services/RegistryService.js';
import { TracingServiceLive } from '../../layers/tracing/index.js';
import { LayerSetupError } from '../../layers/errors.js';
import type { AnyResolvedLayer } from '../../layers/types.js';

const testLayer = Layer.mergeAll(
	PropsService.Default,
	RegistryService.Default,
	TracingServiceLive({})
);

const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
	Effect.runPromiseExit(Effect.provide(effect, testLayer));

describe('buildLayerEffect', () => {
	it('should fail with LayerSetupError when onMount throws', async () => {
		const layer: AnyResolvedLayer = {
			name: 'failing-mount',
			onMount: () => {
				throw new Error('mount boom');
			},
		} as unknown as AnyResolvedLayer;

		const result = await runTest(buildLayerEffect(layer, []));

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

		const result = await runTest(buildLayerEffect(layer, []));

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
});
