import { writeFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { createReactiveProps } from '../blueprint/reactive-props.js';
import { watchEffect } from '../effects/effect.js';

it('reactive props update semantics', () => {
	const lines: string[] = [];

	// 1. Removing a prop.
	{
		const { proxy, update } = createReactiveProps<{ a?: number; b?: number }>({ a: 1, b: 2 });
		const seen: unknown[] = [];
		const h = watchEffect(() => { seen.push(proxy.a); });
		update({ b: 2 });
		lines.push(`remove prop: effect saw ${JSON.stringify(seen)} (expected [1, undefined])`);
		lines.push(`  proxy.a after removal = ${JSON.stringify(proxy.a)}`);
		lines.push(`  'a' in proxy = ${String('a' in proxy)}`);
		h.stop();
	}

	// 2. Adding a prop that did not exist.
	{
		const { proxy, update } = createReactiveProps<{ a?: number; c?: number }>({ a: 1 });
		const seen: unknown[] = [];
		const h = watchEffect(() => { seen.push(proxy.c); });
		update({ a: 1, c: 9 });
		lines.push(`add prop:    effect saw ${JSON.stringify(seen)} (expected [undefined, 9])`);
		lines.push(`  proxy.c after add = ${JSON.stringify(proxy.c)}`);
		h.stop();
	}

	// 3. Changing an existing prop (control).
	{
		const { proxy, update } = createReactiveProps<{ a: number }>({ a: 1 });
		const seen: unknown[] = [];
		const h = watchEffect(() => { seen.push(proxy.a); });
		update({ a: 2 });
		lines.push(`change prop: effect saw ${JSON.stringify(seen)} (expected [1, 2])`);
		h.stop();
	}

	// 4. Remove then re-add.
	{
		const { proxy, update } = createReactiveProps<{ a?: number }>({ a: 1 });
		const seen: unknown[] = [];
		const h = watchEffect(() => { seen.push(proxy.a); });
		update({});
		update({ a: 3 });
		lines.push(`remove+re-add: effect saw ${JSON.stringify(seen)} (expected [1, undefined, 3])`);
		h.stop();
	}

	writeFileSync('/tmp/effuse-props.txt', lines.join('\n'));
	expect(true).toBe(true);
});
