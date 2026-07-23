import { describe, expectTypeOf, it } from 'vitest';
import type { BaseIntrinsicElements } from '../../jsx/types/intrinsic.js';

type HandlerEvent<
	Tag extends keyof BaseIntrinsicElements,
	Key extends keyof BaseIntrinsicElements[Tag],
> =
	NonNullable<BaseIntrinsicElements[Tag][Key]> extends (
		event: infer E
	) => void
		? E
		: never;

describe('JSX event handler types', () => {
	it('should give click handlers a typed currentTarget', () => {
		type ButtonClick = HandlerEvent<'button', 'onClick'>;

		expectTypeOf<ButtonClick>().toExtend<MouseEvent>();
		expectTypeOf<ButtonClick['currentTarget']>().toEqualTypeOf<HTMLButtonElement>();
	});

	it('should give input handlers InputEvent with the concrete element', () => {
		type InputInput = HandlerEvent<'input', 'onInput'>;
		type TextareaInput = HandlerEvent<'textarea', 'onInput'>;

		expectTypeOf<InputInput>().toExtend<InputEvent>();
		expectTypeOf<InputInput['currentTarget']>().toEqualTypeOf<HTMLInputElement>();
		expectTypeOf<TextareaInput['currentTarget']>().toEqualTypeOf<HTMLTextAreaElement>();
	});

	it('should type toggle events as ToggleEvent', () => {
		type DetailsToggle = HandlerEvent<'details', 'onToggle'>;
		type DivBeforeToggle = HandlerEvent<'div', 'onBeforeToggle'>;

		expectTypeOf<DetailsToggle>().toExtend<ToggleEvent>();
		expectTypeOf<DivBeforeToggle>().toExtend<ToggleEvent>();
	});

	it('should expose dialog close and cancel events', () => {
		type DialogClose = HandlerEvent<'dialog', 'onClose'>;
		type DialogCancel = HandlerEvent<'dialog', 'onCancel'>;

		expectTypeOf<DialogClose>().toExtend<Event>();
		expectTypeOf<DialogClose['currentTarget']>().toEqualTypeOf<HTMLDialogElement>();
		expectTypeOf<DialogCancel>().toExtend<Event>();
	});

	it('should expose beforeinput and cuechange events', () => {
		type SpanBeforeInput = HandlerEvent<'span', 'onBeforeInput'>;
		type TrackCueChange = HandlerEvent<'track', 'onCueChange'>;

		expectTypeOf<SpanBeforeInput>().toExtend<InputEvent>();
		expectTypeOf<TrackCueChange>().toExtend<Event>();
	});

	it('should not admit string in error handlers', () => {
		type ImgError = HandlerEvent<'img', 'onError'>;

		expectTypeOf<ImgError>().toExtend<Event>();
		expectTypeOf<string>().not.toExtend<ImgError>();
	});

	it('should thread SVG element types through handlers', () => {
		type CircleClick = HandlerEvent<'circle', 'onClick'>;
		type SvgPointer = HandlerEvent<'svg', 'onPointerDown'>;

		expectTypeOf<CircleClick['currentTarget']>().toEqualTypeOf<SVGCircleElement>();
		expectTypeOf<SvgPointer>().toExtend<PointerEvent>();
		expectTypeOf<SvgPointer['currentTarget']>().toEqualTypeOf<SVGSVGElement>();
	});

	it('should keep media handlers on media elements', () => {
		type VideoTimeUpdate = HandlerEvent<'video', 'onTimeUpdate'>;

		expectTypeOf<VideoTimeUpdate['currentTarget']>().toEqualTypeOf<HTMLVideoElement>();
	});

	it('should default generic containers to their concrete elements', () => {
		type FormSubmit = HandlerEvent<'form', 'onSubmit'>;
		type SelectChange = HandlerEvent<'select', 'onChange'>;

		expectTypeOf<FormSubmit>().toExtend<SubmitEvent>();
		expectTypeOf<FormSubmit['currentTarget']>().toEqualTypeOf<HTMLFormElement>();
		expectTypeOf<SelectChange['currentTarget']>().toEqualTypeOf<HTMLSelectElement>();
	});

	it('should keep handler props assignable from plain listeners', () => {
		const attrs: BaseIntrinsicElements['button'] = {
			onClick: (event) => {
				expectTypeOf(event.currentTarget.disabled).toEqualTypeOf<boolean>();
			},
		};

		expectTypeOf(attrs).toExtend<BaseIntrinsicElements['button']>();
	});
});
