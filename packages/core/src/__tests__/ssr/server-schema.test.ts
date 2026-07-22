import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	serverSchema,
	type ServerSchemaInput,
	type ServerSchemaOutput,
} from '../../ssr/server-schema.js';
import {
	ServerValidationError,
	validateServerValue,
} from '../../ssr/validation.js';

describe('serverSchema composition', () => {
	it('composes object schemas inside arrays with input/output inference', () => {
		const Payload = serverSchema.object({
			posts: serverSchema.array(
				serverSchema.object({
					id: serverSchema.numberFromString,
					title: serverSchema.string,
				})
			),
		});

		type Input = ServerSchemaInput<typeof Payload>;
		type Output = ServerSchemaOutput<typeof Payload>;
		expectTypeOf({} as Input).toEqualTypeOf<{
			posts: readonly { id: string; title: string }[];
		}>();
		expectTypeOf({} as Output).toEqualTypeOf<{
			posts: readonly { id: number; title: string }[];
		}>();

		expect(
			validateServerValue(
				'value',
				{ posts: [{ id: '42', title: 'Effuse' }] },
				Payload
			)
		).toEqual({ posts: [{ id: 42, title: 'Effuse' }] });
	});

	it('recursively composes object schemas in arrays and unions', () => {
		const Payload = serverSchema.object({
			results: serverSchema.array(
				serverSchema.union(
					serverSchema.object({
						kind: serverSchema.literal('post'),
						id: serverSchema.numberFromString,
					}),
					serverSchema.object({
						kind: serverSchema.literal('error'),
						message: serverSchema.string,
					})
				)
			),
		});

		expect(
			Payload.validateSync({
				results: [
					{ kind: 'post', id: '7' },
					{ kind: 'error', message: 'Not found' },
				],
			})
		).toEqual({
			results: [
				{ kind: 'post', id: 7 },
				{ kind: 'error', message: 'Not found' },
			],
		});
	});

	it('preserves optional and default behavior for composed schemas', () => {
		const Rows = serverSchema.array(
			serverSchema.object({ id: serverSchema.numberFromString })
		);
		const OptionalPayload = serverSchema.object({
			rows: serverSchema.optional(Rows),
		});
		const DefaultPayload = serverSchema.object({
			rows: serverSchema.optional(Rows, []),
		});

		expectTypeOf(
			{} as ServerSchemaInput<typeof OptionalPayload>
		).toEqualTypeOf<{ rows?: readonly { id: string }[] }>();
		expectTypeOf(
			{} as ServerSchemaOutput<typeof OptionalPayload>
		).toEqualTypeOf<{ rows: readonly { id: number }[] | undefined }>();
		expectTypeOf(
			{} as ServerSchemaOutput<typeof DefaultPayload>
		).toEqualTypeOf<{ rows: readonly { id: number }[] }>();

		expect(OptionalPayload.validateSync({})).toEqual({});
		expect(DefaultPayload.validateSync({})).toEqual({ rows: [] });
	});

	it('reports stable indexed paths for invalid nested fields', () => {
		const Payload = serverSchema.object({
			posts: serverSchema.array(
				serverSchema.object({ id: serverSchema.numberFromString })
			),
		});

		try {
			validateServerValue(
				'value',
				{ posts: [{ id: '1' }, { id: 'invalid' }] },
				Payload
			);
			expect.unreachable('validation should reject the second post');
		} catch (error) {
			expect(error).toBeInstanceOf(ServerValidationError);
			expect((error as ServerValidationError).issues).toMatchObject([
				{ path: 'posts.1.id' },
			]);
		}
	});

	it('rejects values that are not Effuse schemas at compile time', () => {
		if (false) {
			// @ts-expect-error arbitrary objects are not native schema members
			serverSchema.array({ parse: () => 'not-an-effuse-schema' });
			serverSchema.optional(
				serverSchema.array(
					serverSchema.object({ id: serverSchema.numberFromString })
				),
				// @ts-expect-error defaults must use the decoded output type
				[{ id: 'not-decoded' }]
			);
		}
		expect(true).toBe(true);
	});
});
