/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
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
			view: (ctx: { props: Record<string, unknown>; state: Record<string, unknown> }) => unknown;
		};

		const state = blueprint.state({ title: 'World' });
		const rendered = blueprint.view({ props: { title: 'World' }, state });

		expect(rendered).toBe('Hello, World');
	});
});

describe('single-arg template context', () => {
	it('should merge exposed values and props into one context', () => {
		let capturedCtx: unknown;

		const Comp = define({
			props: { label: 'default' },
			script: ({ props }) => {
				return { doubled: (props.label as string).repeat(2) };
			},
			template: (ctx) => {
				capturedCtx = ctx;
				return `${ctx.doubled}-${ctx.label}`;
			},
		});

		const blueprint = Comp as unknown as {
			state: (props: Record<string, unknown>) => Record<string, unknown>;
			view: (ctx: { props: Record<string, unknown>; state: Record<string, unknown> }) => unknown;
		};

		const state = blueprint.state({ label: 'A' });
		const rendered = blueprint.view({ props: { label: 'A' }, state });

		expect(rendered).toBe('AA-A');
		expect(capturedCtx).toMatchObject({ label: 'A', doubled: 'AA' });
	});

	it('should include children in the merged context', () => {
		const Comp = define({
			script: () => ({ count: 1 }),
			template: (ctx) => ctx.children,
		});

		const blueprint = Comp as unknown as {
			state: (props: Record<string, unknown>) => Record<string, unknown>;
			view: (ctx: { props: Record<string, unknown>; state: Record<string, unknown> }) => unknown;
		};

		const state = blueprint.state({});
		const rendered = blueprint.view({ props: { children: 'child-content' }, state });

		expect(rendered).toBe('child-content');
	});
});
