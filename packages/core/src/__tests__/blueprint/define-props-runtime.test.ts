import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { define, defineProps } from '../../blueprint/define.js';
import { PropSchema, PropsValidationError } from '../../blueprint/props.js';

type TestBlueprint = {
	state: (props: Record<string, unknown>) => Record<string, unknown>;
	view: (ctx: {
		props: Record<string, unknown>;
		state: Record<string, unknown>;
	}) => unknown;
};

const asBlueprint = (component: unknown): TestBlueprint =>
	component as TestBlueprint;

describe('define props runtime contract', () => {
	it('applies inline defaults initially and on prop updates', () => {
		const Component = define({
			props: { label: 'fallback', count: 1 },
			script: ({ props }) => ({ props }),
			template: ({ label, count }) => `${label}:${count}`,
		});
		const blueprint = asBlueprint(Component);
		const state = blueprint.state({ label: 'initial' });

		expect(blueprint.view({ props: {}, state })).toBe('initial:1');
		(state.updateProps as (props: Record<string, unknown>) => void)({
			count: 2,
		});
		expect(blueprint.view({ props: {}, state })).toBe('fallback:2');
	});

	it('keeps defineProps type-only while enforcing required call props', () => {
		const declaration = defineProps<{ title: string }>();
		expect(declaration).toEqual({});

		const Component = define({
			props: declaration,
			script: () => ({}),
			template: ({ title }) => title,
		});

		expectTypeOf(Component).toBeCallableWith({ title: 'Effuse' });
		if (false) {
			// @ts-expect-error declared required props cannot be omitted
			Component();
		}
	});

	it('validates schemas and supports nested builders with defaults', () => {
		const address = PropSchema.struct({
			city: PropSchema.required(PropSchema.String),
		});
		const propsSchema = PropSchema.struct({
			address: PropSchema.required(address),
			role: PropSchema.optional(PropSchema.String, 'member'),
		});
		const Component = define({
			props: defineProps<{ address: { city: string }; role: string }>(),
			propsSchema,
			script: () => ({}),
			template: ({ address: value, role }) => `${value.city}:${role}`,
		});
		const blueprint = asBlueprint(Component);
		const state = blueprint.state({ address: { city: 'San Juan' } });

		expect(blueprint.view({ props: {}, state })).toBe('San Juan:member');
		try {
			blueprint.state({ address: {} });
			expect.unreachable('invalid nested props should fail validation');
		} catch (error) {
			expect(error).toBeInstanceOf(PropsValidationError);
			expect((error as PropsValidationError).propName).toBe('address.city');
		}
		expect(() =>
			(state.updateProps as (props: Record<string, unknown>) => void)({
				address: {},
			})
		).toThrow(PropsValidationError);
		expect(blueprint.view({ props: {}, state })).toBe('San Juan:member');
	});

	it('cleans lifecycle resources when script setup throws', () => {
		const cleanup = vi.fn();
		const Component = define({
			script: ({ onUnmount }) => {
				onUnmount(cleanup);
				throw new Error('setup failed');
			},
			template: () => null,
		});

		expect(() => asBlueprint(Component).state({})).toThrow('setup failed');
		expect(cleanup).toHaveBeenCalledOnce();
	});
});
