import { describe, expectTypeOf, it } from 'vitest';
import type { BaseIntrinsicElements } from '../../jsx/types/intrinsic.js';
import type { Ref } from '../../refs/types.js';

type IntrinsicRef<Tag extends keyof BaseIntrinsicElements> = NonNullable<
	BaseIntrinsicElements[Tag]['ref']
>;

describe('JSX ref types', () => {
	it('uses the concrete intrinsic element and includes the detach transition', () => {
		expectTypeOf<IntrinsicRef<'button'>>().toEqualTypeOf<
			Ref<HTMLButtonElement>
		>();
		expectTypeOf<IntrinsicRef<'input'>>().toEqualTypeOf<Ref<HTMLInputElement>>();
		expectTypeOf<IntrinsicRef<'circle'>>().toEqualTypeOf<
			Ref<SVGCircleElement>
		>();

		const attrs: BaseIntrinsicElements['button'] = {
			ref: (element) => {
				expectTypeOf(element).toEqualTypeOf<HTMLButtonElement | null>();
			},
		};
		expectTypeOf(attrs).toExtend<BaseIntrinsicElements['button']>();
	});
});
