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

export interface DOMAttributes {
	children?: EffuseChild;

	// Clipboard Events
	onCopy?: (e: ClipboardEvent) => void;
	onCut?: (e: ClipboardEvent) => void;
	onPaste?: (e: ClipboardEvent) => void;

	// Composition Events
	onCompositionEnd?: (e: CompositionEvent) => void;
	onCompositionStart?: (e: CompositionEvent) => void;
	onCompositionUpdate?: (e: CompositionEvent) => void;

	// Focus Events
	onFocus?: (e: FocusEvent) => void;
	onBlur?: (e: FocusEvent) => void;
	onFocusIn?: (e: FocusEvent) => void;
	onFocusOut?: (e: FocusEvent) => void;

	// Form Events
	onChange?: (e: Event) => void;
	onInput?: (e: Event) => void;
	onReset?: (e: Event) => void;
	onSubmit?: (e: SubmitEvent) => void;
	onInvalid?: (e: Event) => void;
	onFormData?: (e: FormDataEvent) => void;

	// Image Events
	onLoad?: (e: Event) => void;
	onError?: (e: Event | string) => void;

	// Keyboard Events
	onKeyDown?: (e: KeyboardEvent) => void;
	onKeyPress?: (e: KeyboardEvent) => void;
	onKeyUp?: (e: KeyboardEvent) => void;

	// Mouse Events
	onClick?: (e: MouseEvent) => void;
	onContextMenu?: (e: MouseEvent) => void;
	onDblClick?: (e: MouseEvent) => void;
	onMouseDown?: (e: MouseEvent) => void;
	onMouseEnter?: (e: MouseEvent) => void;
	onMouseLeave?: (e: MouseEvent) => void;
	onMouseMove?: (e: MouseEvent) => void;
	onMouseOut?: (e: MouseEvent) => void;
	onMouseOver?: (e: MouseEvent) => void;
	onMouseUp?: (e: MouseEvent) => void;
	onAuxClick?: (e: MouseEvent) => void;

	// Pointer Events
	onPointerDown?: (e: PointerEvent) => void;
	onPointerMove?: (e: PointerEvent) => void;
	onPointerUp?: (e: PointerEvent) => void;
	onPointerCancel?: (e: PointerEvent) => void;
	onPointerEnter?: (e: PointerEvent) => void;
	onPointerLeave?: (e: PointerEvent) => void;
	onPointerOver?: (e: PointerEvent) => void;
	onPointerOut?: (e: PointerEvent) => void;
	onGotPointerCapture?: (e: PointerEvent) => void;
	onLostPointerCapture?: (e: PointerEvent) => void;

	// Touch Events
	onTouchCancel?: (e: TouchEvent) => void;
	onTouchEnd?: (e: TouchEvent) => void;
	onTouchMove?: (e: TouchEvent) => void;
	onTouchStart?: (e: TouchEvent) => void;

	// Drag Events
	onDrag?: (e: DragEvent) => void;
	onDragEnd?: (e: DragEvent) => void;
	onDragEnter?: (e: DragEvent) => void;
	onDragExit?: (e: DragEvent) => void;
	onDragLeave?: (e: DragEvent) => void;
	onDragOver?: (e: DragEvent) => void;
	onDragStart?: (e: DragEvent) => void;
	onDrop?: (e: DragEvent) => void;

	// Scroll Events
	onScroll?: (e: Event) => void;
	onScrollEnd?: (e: Event) => void;

	// Wheel Events
	onWheel?: (e: WheelEvent) => void;

	// Animation Events
	onAnimationStart?: (e: AnimationEvent) => void;
	onAnimationEnd?: (e: AnimationEvent) => void;
	onAnimationIteration?: (e: AnimationEvent) => void;
	onAnimationCancel?: (e: AnimationEvent) => void;

	// Transition Events
	onTransitionStart?: (e: TransitionEvent) => void;
	onTransitionEnd?: (e: TransitionEvent) => void;
	onTransitionRun?: (e: TransitionEvent) => void;
	onTransitionCancel?: (e: TransitionEvent) => void;

	// Selection Events
	onSelect?: (e: Event) => void;
	onSelectionChange?: (e: Event) => void;

	// Media Events
	onAbort?: (e: Event) => void;
	onCanPlay?: (e: Event) => void;
	onCanPlayThrough?: (e: Event) => void;
	onDurationChange?: (e: Event) => void;
	onEmptied?: (e: Event) => void;
	onEnded?: (e: Event) => void;
	onLoadedData?: (e: Event) => void;
	onLoadedMetadata?: (e: Event) => void;
	onLoadStart?: (e: Event) => void;
	onPause?: (e: Event) => void;
	onPlay?: (e: Event) => void;
	onPlaying?: (e: Event) => void;
	onProgress?: (e: ProgressEvent) => void;
	onRateChange?: (e: Event) => void;
	onSeeked?: (e: Event) => void;
	onSeeking?: (e: Event) => void;
	onStalled?: (e: Event) => void;
	onSuspend?: (e: Event) => void;
	onTimeUpdate?: (e: Event) => void;
	onVolumeChange?: (e: Event) => void;
	onWaiting?: (e: Event) => void;

	// Toggle Events (for details element)
	onToggle?: (e: Event) => void;

	// Fullscreen Events
	onFullscreenChange?: (e: Event) => void;
	onFullscreenError?: (e: Event) => void;

	// Picture-in-Picture Events
	onEnterPictureInPicture?: (e: Event) => void;
	onLeavePictureInPicture?: (e: Event) => void;

	// Resize Events
	onResize?: (e: UIEvent) => void;

	// Security Events
	onSecurityPolicyViolation?: (e: SecurityPolicyViolationEvent) => void;

	// Slot Events
	onSlotChange?: (e: Event) => void;
}
