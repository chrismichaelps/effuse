import { describe, expectTypeOf, it } from 'vitest';
import { signal } from '../../reactivity/signal.js';
import type { InputAttributes } from '../../jsx/types/elements.js';

describe('JSX attribute types', () => {
	it('should accept reactive aria-invalid values', () => {
		const attrs: InputAttributes[] = [
			{ 'aria-invalid': () => true },
			{ 'aria-invalid': () => 'grammar' },
			{ 'aria-invalid': signal(false) },
		];

		expectTypeOf(attrs).toEqualTypeOf<InputAttributes[]>();
	});
});
