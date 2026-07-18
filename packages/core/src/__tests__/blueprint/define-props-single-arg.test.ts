/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, vi } from 'vitest';
import { define, defineProps } from '../../blueprint/define.js';

describe('defineProps', () => {
	it('should return an empty object at runtime', () => {
		const props = defineProps<{ name: string; count: number }>();
		expect(props).toEqual({});
	});

	it('should work inside define() for type inference', () => {
		const Comp = define({
			props: defineProps<{ title: string }>(),
			script: ({ props }) => {
				return { greeting: `Hello, ${props.title}` };
			},
			template: (ctx) => ctx.greeting,
		});

		const blueprint = Comp as unknown as {
			state: (props: Record<string, unknown>) => Record<string, unknown>;
			view: (ctx: {
				props: Record<string, unknown>;
				state: Record<string, unknown>;
			}) => unknown;
		};

		const state = blueprint.state({ title: 'World' });
		const rendered = blueprint.view({ props: { title: 'World' }, state });

		expect(rendered).toBe('Hello, World');
	});
});

describe('single-arg template context', () => {
	it('should provide namespaced and flat access for unambiguous values', () => {
		let capturedCtx: unknown;

		const Comp = define({
			props: { label: 'default' },
			script: ({ props }) => {
				return { doubled: (props.label as string).repeat(2) };
			},
			template: (ctx) => {
				capturedCtx = ctx;
				return `${ctx.doubled}-${ctx.label}-${ctx.exposed.doubled}-${ctx.props.label}`;
			},
		});

		const blueprint = Comp as unknown as {
			state: (props: Record<string, unknown>) => Record<string, unknown>;
			view: (ctx: {
				props: Record<string, unknown>;
				state: Record<string, unknown>;
			}) => unknown;
		};

		const state = blueprint.state({ label: 'A' });
		const rendered = blueprint.view({ props: { label: 'A' }, state });

		expect(rendered).toBe('AA-A-AA-A');
		expect(capturedCtx).toMatchObject({
			label: 'A',
			doubled: 'AA',
			props: { label: 'A' },
			exposed: { doubled: 'AA' },
		});
	});

	it('should remove colliding values from flat access without losing either owner', () => {
		let capturedCtx: Record<string, unknown> | undefined;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const Comp = define({
			name: 'CollisionProbe',
			props: { label: 'prop-default' },
			script: () => ({ label: 'exposed-value', stable: 'flat-value' }),
			template: (ctx) => {
				capturedCtx = ctx as unknown as Record<string, unknown>;
				return `${ctx.props.label}|${ctx.exposed.label}|${ctx.stable}`;
			},
		});

		const blueprint = Comp as unknown as {
			state: (props: Record<string, unknown>) => Record<string, unknown>;
			view: (ctx: {
				props: Record<string, unknown>;
				state: Record<string, unknown>;
			}) => unknown;
		};
		const state = blueprint.state({ label: 'prop-value' });

		expect(blueprint.view({ props: { label: 'prop-value' }, state })).toBe(
			'prop-value|exposed-value|flat-value'
		);
		expect(capturedCtx).not.toHaveProperty('label');
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining(
				'Component "CollisionProbe" cannot flatten template key "label"'
			)
		);

		(state.updateProps as (props: Record<string, unknown>) => void)({
			label: 'updated-prop',
		});
		expect(blueprint.view({ props: { label: 'stale-prop' }, state })).toBe(
			'updated-prop|exposed-value|flat-value'
		);
		blueprint.view({ props: { label: 'prop-value' }, state });
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it('should reserve context namespace keys and rendered children', () => {
		let capturedCtx: Record<string, unknown> | undefined;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const Comp = define({
			name: 'ReservedKeyProbe',
			props: { props: 'prop-namespace-value' },
			script: () => ({
				exposed: 'exposed-namespace-value',
				children: 'exposed-child',
			}),
			template: (ctx) => {
				capturedCtx = ctx as unknown as Record<string, unknown>;
				return `${ctx.props.props}|${ctx.exposed.exposed}|${ctx.exposed.children}|${String(ctx.children)}`;
			},
		});

		const blueprint = Comp as unknown as {
			state: (props: Record<string, unknown>) => Record<string, unknown>;
			view: (ctx: {
				props: Record<string, unknown>;
				state: Record<string, unknown>;
			}) => unknown;
		};
		const state = blueprint.state({ props: 'prop-namespace-value' });

		expect(
			blueprint.view({
				props: { props: 'prop-namespace-value', children: 'rendered-child' },
				state,
			})
		).toBe(
			'prop-namespace-value|exposed-namespace-value|exposed-child|rendered-child'
		);
		expect(capturedCtx?.props).toEqual({ props: 'prop-namespace-value' });
		expect(capturedCtx?.exposed).toEqual({
			exposed: 'exposed-namespace-value',
			children: 'exposed-child',
		});
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it('should preserve ownership for colliding symbol keys', () => {
		const key = Symbol('contract');
		let hasFlatSymbol = true;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const Comp = define({
			name: 'SymbolCollisionProbe',
			props: { [key]: 'prop-symbol' },
			script: () => ({ [key]: 'exposed-symbol' }),
			template: (ctx) => {
				hasFlatSymbol = Object.prototype.hasOwnProperty.call(ctx, key);
				return `${ctx.props[key]}|${ctx.exposed[key]}`;
			},
		});

		const blueprint = Comp as unknown as {
			state: (props: Record<PropertyKey, unknown>) => Record<string, unknown>;
			view: (ctx: {
				props: Record<PropertyKey, unknown>;
				state: Record<string, unknown>;
			}) => unknown;
		};
		const state = blueprint.state({ [key]: 'prop-symbol' });

		expect(blueprint.view({ props: { [key]: 'prop-symbol' }, state })).toBe(
			'prop-symbol|exposed-symbol'
		);
		expect(hasFlatSymbol).toBe(false);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Symbol(contract)')
		);
		warn.mockRestore();
	});

	it('should include children in the merged context', () => {
		const Comp = define({
			script: () => ({ count: 1 }),
			template: (ctx) => ctx.children,
		});

		const blueprint = Comp as unknown as {
			state: (props: Record<string, unknown>) => Record<string, unknown>;
			view: (ctx: {
				props: Record<string, unknown>;
				state: Record<string, unknown>;
			}) => unknown;
		};

		const state = blueprint.state({});
		const rendered = blueprint.view({
			props: { children: 'child-content' },
			state,
		});

		expect(rendered).toBe('child-content');
	});
});
