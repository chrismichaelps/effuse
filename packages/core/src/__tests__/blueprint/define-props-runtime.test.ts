import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Schema } from 'effect';
import { define, defineProps } from '../../blueprint/define.js';
import {
	PropSchema,
	PropsSchemaConflictError,
	PropsValidationError,
} from '../../blueprint/props.js';

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

	it('infers caller inputs separately from resolved schema props', () => {
		const addressSchema = PropSchema.struct({
			city: PropSchema.required(PropSchema.String),
			unit: PropSchema.optional(PropSchema.String),
		});
		const propsSchema = PropSchema.struct({
			address: PropSchema.optional(addressSchema),
			count: PropSchema.required(Schema.NumberFromString),
			name: PropSchema.required(PropSchema.String),
			role: PropSchema.optional(PropSchema.String, 'member'),
		});
		const Component = define({
			props: defineProps(propsSchema),
			script: ({ props }) => {
				const address: { city: string; unit: string | undefined } | undefined =
					props.address;
				void address;
				expectTypeOf(props.count).toEqualTypeOf<number>();
				expectTypeOf(props.role).toEqualTypeOf<string>();
				return {};
			},
			template: ({ count, name, role }) => `${name}:${role}:${String(count)}`,
		});

		expectTypeOf(Component).toBeCallableWith({ count: '3', name: 'Effuse' });
		expectTypeOf(Component).toBeCallableWith({
			address: { city: 'San Juan' },
			count: '3',
			name: 'Effuse',
		});
		if (false) {
			// @ts-expect-error required schema inputs cannot be omitted
			Component({ name: 'Effuse' });
			// @ts-expect-error transforms expose their encoded input to callers
			Component({ count: 3, name: 'Effuse' });
		}

		const blueprint = asBlueprint(Component);
		const state = blueprint.state({ count: '3', name: 'Effuse' });
		expect(blueprint.view({ props: {}, state })).toBe('Effuse:member:3');
		(state.updateProps as (props: Record<string, unknown>) => void)({
			count: '4',
			name: 'Effuse',
		});
		expect(blueprint.view({ props: {}, state })).toBe('Effuse:member:4');
		expect(() =>
			(state.updateProps as (props: Record<string, unknown>) => void)({
				count: 4,
				name: 'Effuse',
			})
		).toThrow(PropsValidationError);
		expect(blueprint.view({ props: {}, state })).toBe('Effuse:member:4');
	});

	it('allows callers to omit an entirely defaulted schema', () => {
		const schema = PropSchema.struct({
			role: PropSchema.optional(PropSchema.String, 'member'),
		});
		const declaration = defineProps(schema);
		const Component = define({
			props: declaration,
			script: ({ props }) => {
				expectTypeOf(props.role).toEqualTypeOf<string>();
				return {};
			},
			template: ({ role }) => role,
		});

		expect(declaration).toEqual({});
		expectTypeOf(Component).toBeCallableWith();
		expect(asBlueprint(Component).state({})).toBeDefined();
	});

	it('rejects competing schema sources', () => {
		const first = PropSchema.struct({
			name: PropSchema.required(PropSchema.String),
		});
		const second = PropSchema.struct({
			name: PropSchema.required(PropSchema.String),
		});

		expect(() =>
			define({
				name: 'ConflictingProps',
				props: defineProps(first),
				propsSchema: second,
				script: () => ({}),
				template: ({ name }) => name,
			})
		).toThrow(PropsSchemaConflictError);
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
