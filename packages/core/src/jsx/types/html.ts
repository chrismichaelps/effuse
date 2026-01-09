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

import type { AriaAttributes } from './aria.js';
import type { DOMAttributes } from './events.js';
import type {
	TextDirection,
	ContentEditable,
	InputMode,
	EnterKeyHint,
	AutoCapitalize,
	PopoverType,
	PopoverTargetAction,
} from './unions.js';

export interface HTMLAttributes extends AriaAttributes, DOMAttributes {
	// Core Attributes
	key?: string | number | undefined;
	ref?: ((el: unknown) => void) | undefined;

	// Identifiers
	id?: string | (() => string);

	// Class / Styling
	class?:
		| string
		| Record<string, boolean>
		| (string | Record<string, boolean>)[]
		| (() => string | undefined | null);
	className?: string | (() => string | undefined | null);
	style?:
		| string
		| Partial<CSSStyleDeclaration>
		| (() => string | Partial<CSSStyleDeclaration>);

	// Text Content
	title?: string | (() => string);

	// Tab Navigation
	tabIndex?: number;

	// Visibility
	hidden?: boolean | 'hidden' | 'until-found' | (() => boolean);

	// Language
	lang?: string;
	dir?: TextDirection;
	translate?: 'yes' | 'no';

	// Editing
	contentEditable?: ContentEditable;
	spellcheck?: boolean | 'true' | 'false';

	// Interaction
	draggable?: boolean | 'true' | 'false';
	enterKeyHint?: EnterKeyHint;
	inputMode?: InputMode;

	// Accessibility
	accessKey?: string;

	// Custom Data Attributes
	[key: `data-${string}`]: unknown;

	// Slot (Web Components)
	slot?: string;

	// Nonce (CSP)
	nonce?: string;

	// Part (CSS Shadow Parts)
	part?: string;

	// Popover API
	popover?: PopoverType;
	popoverTarget?: string;
	popoverTargetAction?: PopoverTargetAction;

	// Inert
	inert?: boolean;

	// Autocapitalize
	autocapitalize?: AutoCapitalize;

	// Autofocus (global in HTML5.2+)
	autofocus?: boolean;

	// Item Scope (Microdata)
	itemscope?: boolean;
	itemprop?: string;
	itemtype?: string;
	itemid?: string;
	itemref?: string;

	// Allow unknown props
	[key: string]: unknown;
}
