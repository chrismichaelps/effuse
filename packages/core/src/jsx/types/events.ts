/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { EffuseChild } from '../../render/node.js';

/**
 * Event handler whose event carries the concrete element the handler was
 * attached to. The renderer binds handlers with addEventListener, so
 * currentTarget is always the owning element while the handler runs.
 */
export type EffuseEvent<
	Target extends EventTarget,
	Ev extends Event,
> = Omit<Ev, 'currentTarget'> & { readonly currentTarget: Target };

/**
 * Method syntax keeps handler parameters bivariant, so an element-specific
 * attributes object stays assignable to the custom-element catch-all in the
 * intrinsic elements map.
 */
export type EffuseEventHandler<
	Target extends EventTarget,
	Ev extends Event,
> = {
	bivarianceHack(event: EffuseEvent<Target, Ev>): void;
}['bivarianceHack'];

export interface DOMAttributes<Target extends EventTarget = HTMLElement> {
	children?: EffuseChild;

	// Clipboard Events
	onCopy?: EffuseEventHandler<Target, ClipboardEvent>;
	onCut?: EffuseEventHandler<Target, ClipboardEvent>;
	onPaste?: EffuseEventHandler<Target, ClipboardEvent>;

	// Composition Events
	onCompositionEnd?: EffuseEventHandler<Target, CompositionEvent>;
	onCompositionStart?: EffuseEventHandler<Target, CompositionEvent>;
	onCompositionUpdate?: EffuseEventHandler<Target, CompositionEvent>;

	// Focus Events
	onFocus?: EffuseEventHandler<Target, FocusEvent>;
	onBlur?: EffuseEventHandler<Target, FocusEvent>;
	onFocusIn?: EffuseEventHandler<Target, FocusEvent>;
	onFocusOut?: EffuseEventHandler<Target, FocusEvent>;

	// Form Events
	onChange?: EffuseEventHandler<Target, Event>;
	onInput?: EffuseEventHandler<Target, InputEvent>;
	onBeforeInput?: EffuseEventHandler<Target, InputEvent>;
	onReset?: EffuseEventHandler<Target, Event>;
	onSubmit?: EffuseEventHandler<Target, SubmitEvent>;
	onInvalid?: EffuseEventHandler<Target, Event>;
	onFormData?: EffuseEventHandler<Target, FormDataEvent>;

	// Image Events
	onLoad?: EffuseEventHandler<Target, Event>;
	onError?: EffuseEventHandler<Target, Event>;

	// Keyboard Events
	onKeyDown?: EffuseEventHandler<Target, KeyboardEvent>;
	onKeyPress?: EffuseEventHandler<Target, KeyboardEvent>;
	onKeyUp?: EffuseEventHandler<Target, KeyboardEvent>;

	// Mouse Events
	onClick?: EffuseEventHandler<Target, MouseEvent>;
	onContextMenu?: EffuseEventHandler<Target, MouseEvent>;
	onDblClick?: EffuseEventHandler<Target, MouseEvent>;
	onMouseDown?: EffuseEventHandler<Target, MouseEvent>;
	onMouseEnter?: EffuseEventHandler<Target, MouseEvent>;
	onMouseLeave?: EffuseEventHandler<Target, MouseEvent>;
	onMouseMove?: EffuseEventHandler<Target, MouseEvent>;
	onMouseOut?: EffuseEventHandler<Target, MouseEvent>;
	onMouseOver?: EffuseEventHandler<Target, MouseEvent>;
	onMouseUp?: EffuseEventHandler<Target, MouseEvent>;
	onAuxClick?: EffuseEventHandler<Target, MouseEvent>;

	// Pointer Events
	onPointerDown?: EffuseEventHandler<Target, PointerEvent>;
	onPointerMove?: EffuseEventHandler<Target, PointerEvent>;
	onPointerUp?: EffuseEventHandler<Target, PointerEvent>;
	onPointerCancel?: EffuseEventHandler<Target, PointerEvent>;
	onPointerEnter?: EffuseEventHandler<Target, PointerEvent>;
	onPointerLeave?: EffuseEventHandler<Target, PointerEvent>;
	onPointerOver?: EffuseEventHandler<Target, PointerEvent>;
	onPointerOut?: EffuseEventHandler<Target, PointerEvent>;
	onGotPointerCapture?: EffuseEventHandler<Target, PointerEvent>;
	onLostPointerCapture?: EffuseEventHandler<Target, PointerEvent>;

	// Touch Events
	onTouchCancel?: EffuseEventHandler<Target, TouchEvent>;
	onTouchEnd?: EffuseEventHandler<Target, TouchEvent>;
	onTouchMove?: EffuseEventHandler<Target, TouchEvent>;
	onTouchStart?: EffuseEventHandler<Target, TouchEvent>;

	// Drag Events
	onDrag?: EffuseEventHandler<Target, DragEvent>;
	onDragEnd?: EffuseEventHandler<Target, DragEvent>;
	onDragEnter?: EffuseEventHandler<Target, DragEvent>;
	onDragExit?: EffuseEventHandler<Target, DragEvent>;
	onDragLeave?: EffuseEventHandler<Target, DragEvent>;
	onDragOver?: EffuseEventHandler<Target, DragEvent>;
	onDragStart?: EffuseEventHandler<Target, DragEvent>;
	onDrop?: EffuseEventHandler<Target, DragEvent>;

	// Scroll Events
	onScroll?: EffuseEventHandler<Target, Event>;
	onScrollEnd?: EffuseEventHandler<Target, Event>;

	// Wheel Events
	onWheel?: EffuseEventHandler<Target, WheelEvent>;

	// Animation Events
	onAnimationStart?: EffuseEventHandler<Target, AnimationEvent>;
	onAnimationEnd?: EffuseEventHandler<Target, AnimationEvent>;
	onAnimationIteration?: EffuseEventHandler<Target, AnimationEvent>;
	onAnimationCancel?: EffuseEventHandler<Target, AnimationEvent>;

	// Transition Events
	onTransitionStart?: EffuseEventHandler<Target, TransitionEvent>;
	onTransitionEnd?: EffuseEventHandler<Target, TransitionEvent>;
	onTransitionRun?: EffuseEventHandler<Target, TransitionEvent>;
	onTransitionCancel?: EffuseEventHandler<Target, TransitionEvent>;

	// Selection Events
	onSelect?: EffuseEventHandler<Target, Event>;
	onSelectionChange?: EffuseEventHandler<Target, Event>;

	// Media Events
	onAbort?: EffuseEventHandler<Target, Event>;
	onCanPlay?: EffuseEventHandler<Target, Event>;
	onCanPlayThrough?: EffuseEventHandler<Target, Event>;
	onDurationChange?: EffuseEventHandler<Target, Event>;
	onEmptied?: EffuseEventHandler<Target, Event>;
	onEnded?: EffuseEventHandler<Target, Event>;
	onLoadedData?: EffuseEventHandler<Target, Event>;
	onLoadedMetadata?: EffuseEventHandler<Target, Event>;
	onLoadStart?: EffuseEventHandler<Target, Event>;
	onPause?: EffuseEventHandler<Target, Event>;
	onPlay?: EffuseEventHandler<Target, Event>;
	onPlaying?: EffuseEventHandler<Target, Event>;
	onProgress?: EffuseEventHandler<Target, ProgressEvent>;
	onRateChange?: EffuseEventHandler<Target, Event>;
	onSeeked?: EffuseEventHandler<Target, Event>;
	onSeeking?: EffuseEventHandler<Target, Event>;
	onStalled?: EffuseEventHandler<Target, Event>;
	onSuspend?: EffuseEventHandler<Target, Event>;
	onTimeUpdate?: EffuseEventHandler<Target, Event>;
	onVolumeChange?: EffuseEventHandler<Target, Event>;
	onWaiting?: EffuseEventHandler<Target, Event>;
	onCueChange?: EffuseEventHandler<Target, Event>;

	// Toggle Events (details and popover)
	onToggle?: EffuseEventHandler<Target, ToggleEvent>;
	onBeforeToggle?: EffuseEventHandler<Target, ToggleEvent>;

	// Dialog Events
	onClose?: EffuseEventHandler<Target, Event>;
	onCancel?: EffuseEventHandler<Target, Event>;

	// Fullscreen Events
	onFullscreenChange?: EffuseEventHandler<Target, Event>;
	onFullscreenError?: EffuseEventHandler<Target, Event>;

	// Picture-in-Picture Events
	onEnterPictureInPicture?: EffuseEventHandler<Target, Event>;
	onLeavePictureInPicture?: EffuseEventHandler<Target, Event>;

	// Resize Events
	onResize?: EffuseEventHandler<Target, UIEvent>;

	// Security Events
	onSecurityPolicyViolation?: EffuseEventHandler<Target, SecurityPolicyViolationEvent>;

	// Slot Events
	onSlotChange?: EffuseEventHandler<Target, Event>;
}
