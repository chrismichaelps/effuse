import { describe, it, expect } from 'vitest';
import { createTypedContext } from '../../context/typed-context.js';
import {
	createProvideScope,
	runWithProvideScope,
} from '../../blueprint/provide-inject.js';
import { signal } from '../../reactivity/signal.js';
import { ContextNotFoundError } from '../../context/errors.js';

const inScope = <T>(fn: () => T): T =>
	runWithProvideScope(createProvideScope(), fn);

interface Theme {
	readonly mode: string;
}

describe('createTypedContext identity', () => {
	it('gives two contexts with the same name independent identity', () => {
		const a = createTypedContext<string>({ name: 'shared' });
		const b = createTypedContext<string>({ name: 'shared' });

		expect(a).not.toBe(b);

		inScope(() => {
			a.provide('from-a');
			b.provide('from-b');
			// A library and an application choosing the same name must not merge.
			expect(a.use()).toBe('from-a');
			expect(b.use()).toBe('from-b');
		});
	});
});

describe('createTypedContext resolution', () => {
	it('resolves a provided value during render, not on mount', () => {
		const ThemeContext = createTypedContext<Theme>({ name: 'theme' });

		// This is the SSR path: resolution happens while rendering, so no
		// lifecycle hook is required for a consumer to see the value.
		const observed = inScope(() => {
			ThemeContext.provide({ mode: 'dark' });
			return ThemeContext.use();
		});

		expect(observed).toEqual({ mode: 'dark' });
	});

	it('reads a value provided by an ancestor scope', () => {
		const ctx = createTypedContext<string>({ name: 'ancestor' });
		const parent = createProvideScope();

		const observed = runWithProvideScope(parent, () => {
			ctx.provide('from-parent');
			const child = createProvideScope(parent);
			return runWithProvideScope(child, () => ctx.use());
		});

		expect(observed).toBe('from-parent');
	});

	it('lets a nested provider shadow an ancestor', () => {
		const ctx = createTypedContext<string>({ name: 'shadow' });
		const parent = createProvideScope();

		const observed = runWithProvideScope(parent, () => {
			ctx.provide('outer');
			const child = createProvideScope(parent);
			return runWithProvideScope(child, () => {
				ctx.provide('inner');
				return ctx.use();
			});
		});

		expect(observed).toBe('inner');
	});

	it('keeps sibling scopes independent', () => {
		const ctx = createTypedContext<string>({ name: 'siblings' });
		const parent = createProvideScope();

		const [left, right] = runWithProvideScope(parent, () => {
			const a = createProvideScope(parent);
			const b = createProvideScope(parent);
			const first = runWithProvideScope(a, () => {
				ctx.provide('left');
				return ctx.use();
			});
			const second = runWithProvideScope(b, () => {
				ctx.provide('right');
				return ctx.use();
			});
			return [first, second];
		});

		// Order of provision must not leak between siblings.
		expect(left).toBe('left');
		expect(right).toBe('right');
	});
});

describe('createTypedContext absence', () => {
	it('throws a typed error naming the context when no provider exists', () => {
		const ctx = createTypedContext<string>({ name: 'missing' });

		expect(() => inScope(() => ctx.use())).toThrow(ContextNotFoundError);
		expect(() => inScope(() => ctx.use())).toThrow(/missing/);
	});

	it('returns undefined from useOptional when absent', () => {
		const ctx = createTypedContext<string>({ name: 'optional' });
		expect(inScope(() => ctx.useOptional())).toBeUndefined();
	});

	it('falls back to a default value when provided', () => {
		const ctx = createTypedContext<string>({
			name: 'defaulted',
			defaultValue: 'fallback',
		});

		expect(inScope(() => ctx.use())).toBe('fallback');
	});

	it('prefers a provided value over the default', () => {
		const ctx = createTypedContext<string>({
			name: 'defaulted',
			defaultValue: 'fallback',
		});

		expect(
			inScope(() => {
				ctx.provide('explicit');
				return ctx.use();
			})
		).toBe('explicit');
	});
});

describe('createTypedContext reactivity', () => {
	it('carries a signal so consumers track it rather than a snapshot', () => {
		const ctx = createTypedContext<ReturnType<typeof signal<string>>>({
			name: 'reactive',
		});
		const theme = signal('light');

		const read = inScope(() => {
			ctx.provide(theme);
			const consumed = ctx.use();
			return () => consumed.value;
		});

		expect(read()).toBe('light');
		theme.value = 'dark';
		// The consumer sees the update because it holds the signal, not a copy.
		expect(read()).toBe('dark');
	});
});

describe('createTypedContext scope requirements', () => {
	it('throws when providing outside any scope', () => {
		const ctx = createTypedContext<string>({ name: 'unscoped' });
		expect(() => ctx.provide('x')).toThrow(/scope/i);
	});

	it('treats reading outside any scope as absent', () => {
		const ctx = createTypedContext<string>({ name: 'unscoped-read' });
		expect(ctx.useOptional()).toBeUndefined();
	});
});

describe('createTypedContext through SSR component boundaries', () => {
	it('resolves a value provided by an ancestor component during SSR', async () => {
		const { define } = await import('../../blueprint/define.js');
		const { jsx } = await import('../../jsx/runtime.js');
		const { createSSRRuntime } = await import('../../ssr/runtime.js');
		const { renderToFragment } = await import('../../ssr/render.js');

		const ThemeContext = createTypedContext<string>({
			name: 'ssr-theme',
			defaultValue: 'DEFAULT',
		});

		const Consumer = define({
			props: {},
			script: () => ({ theme: ThemeContext.use() }),
			template: ({ theme }) => jsx('span', { children: theme }),
		});

		const App = define({
			props: {},
			script: () => {
				ThemeContext.provide('dark');
				return {};
			},
			template: () => jsx(Consumer, {}),
		});

		const runtime = await createSSRRuntime([]);
		const html = runtime.run(() =>
			renderToFragment(App as never, runtime)
		);

		// A child rendered on the server must see its ancestor's provided value,
		// not silently fall back to the default and correct after hydration.
		expect(html).toContain('dark');
		await runtime.dispose();
	});
});
