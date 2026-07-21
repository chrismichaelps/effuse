import { describe, it, expect, afterEach } from 'vitest';
import { createHandler } from '../../ssr/handler.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { defineServerRequest } from '../../ssr/request-contract.js';
import { defineServerRoute } from '../../ssr/route-contract.js';
import { serverSchema } from '../../ssr/server-schema.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const uploadRoute = defineServerRoute({
	path: '/api/upload',
	request: defineServerRequest({
		formData: serverSchema.object({
			avatar: serverSchema.file,
			caption: serverSchema.string,
		}),
	}),
	POST: (ctx) => {
		// Typed as File — a handler reads the upload directly, no manual casting.
		const avatar: File = ctx.input.formData.avatar;
		return {
			name: avatar.name,
			size: avatar.size,
			caption: ctx.input.formData.caption,
		};
	},
});

const handlerFor = (layer: ReturnType<typeof defineLayer>) =>
	createHandler({ root: undefined as never, layers: [layer] });

describe('multipart request contracts', () => {
	it('decodes an uploaded file and companion fields as typed formData input', async () => {
		const handler = handlerFor(
			defineLayer({ name: 'uploads', server: { routes: [uploadRoute] } })
		);

		const form = new FormData();
		form.set(
			'avatar',
			new File(['hello-bytes'], 'pic.png', { type: 'image/png' })
		);
		form.set('caption', 'my pic');

		const response = await handler(
			new Request('http://localhost:3000/api/upload', {
				method: 'POST',
				body: form,
			})
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			name: 'pic.png',
			size: 11,
			caption: 'my pic',
		});
	});

	it('rejects a non-file value in a file field with a stable 4xx', async () => {
		const handler = handlerFor(
			defineLayer({ name: 'uploads', server: { routes: [uploadRoute] } })
		);

		const form = new FormData();
		// A plain text field where a File is required.
		form.set('avatar', 'not-a-file');
		form.set('caption', 'x');

		const response = await handler(
			new Request('http://localhost:3000/api/upload', {
				method: 'POST',
				body: form,
			})
		);

		expect(response.status).toBe(400);
	});

	it('is exposed on serverSchema', () => {
		expect(serverSchema.file).toBeDefined();
	});
});
