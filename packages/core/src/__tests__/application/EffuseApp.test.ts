import { describe, it, expect } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { LayerNameCollisionError } from '../../layers/errors.js';
import { CreateTextNode, type Component } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';

const createRoot = (): Component => {
	const textNode = CreateTextNode({ [EFFUSE_NODE]: true, text: 'Hello app' });
	return Object.assign(() => textNode, {
		_tag: 'Blueprint',
		view: () => textNode,
	}) as Component;
};

describe('EffuseApp', () => {
	describe('mount', () => {
		it('should reject duplicate layer names before touching the DOM', async () => {
			const FirstLayer = defineLayer({
				name: 'duplicate-app',
			});
			const SecondLayer = defineLayer({
				name: 'duplicate-app',
			});
			const app = await createApp(createRoot()).useLayers([
				FirstLayer,
				SecondLayer,
			]);

			await expect(app.mount('#missing-target')).rejects.toThrow(
				LayerNameCollisionError
			);
			await expect(app.mount('#missing-target')).rejects.toThrow(
				'Layer "duplicate-app" is registered more than once'
			);
		});
	});
});
