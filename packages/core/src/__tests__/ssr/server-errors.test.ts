import { describe, expect, it } from 'vitest';
import {
	createLayerServerErrorBody,
	isLayerServerError,
	LayerServerError,
	layerServerErrorResponse,
} from '../../ssr/server-errors.js';

const FOREIGN_ERROR_BRAND = Symbol.for('effuse.layer-server-error');

class IndependentlyBundledServerError extends Error {
	readonly [FOREIGN_ERROR_BRAND] = true;
	readonly code = 'CROSS_ENTRYPOINT';
	readonly details = { entrypoint: 'client' };
	readonly headers = { 'X-Effuse-Test': 'cross-bundle' };
	readonly status = 418;
}

describe('LayerServerError', () => {
	it('recognizes errors created by an independent public entrypoint bundle', async () => {
		const error = new IndependentlyBundledServerError('Still typed.');

		expect(error).not.toBeInstanceOf(LayerServerError);
		expect(isLayerServerError(error)).toBe(true);
		if (!isLayerServerError(error)) {
			throw new Error('Expected a cross-entrypoint LayerServerError.');
		}

		expect(createLayerServerErrorBody(error)).toEqual({
			error: {
				code: 'CROSS_ENTRYPOINT',
				details: { entrypoint: 'client' },
				message: 'Still typed.',
				status: 418,
			},
		});

		const response = layerServerErrorResponse(error);
		expect(response.status).toBe(418);
		expect(response.headers.get('X-Effuse-Test')).toBe('cross-bundle');
		await expect(response.json()).resolves.toMatchObject({
			error: { code: 'CROSS_ENTRYPOINT', status: 418 },
		});
	});

	it('rejects unbranded objects that only imitate the public fields', () => {
		expect(
			isLayerServerError({
				name: 'LayerServerError',
				message: 'Lookalike.',
				code: 'IMITATION',
				status: 500,
			})
		).toBe(false);
	});
});
