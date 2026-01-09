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

import type { Signal } from '../../reactivity/signal.js';
import type { ReadonlySignal } from '../../types/index.js';

// Reactive boolean type for ARIA attributes that can be bound to signals/functions
type ReactiveBoolean =
	| boolean
	| 'true'
	| 'false'
	| Signal<boolean>
	| ReadonlySignal<boolean>
	| (() => boolean);

export interface AriaAttributes {
	// Widget Attributes
	'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both';
	'aria-checked'?: ReactiveBoolean | 'mixed';
	'aria-disabled'?: ReactiveBoolean;
	'aria-errormessage'?: string;
	'aria-expanded'?: ReactiveBoolean;
	'aria-haspopup'?:
		| boolean
		| 'true'
		| 'false'
		| 'menu'
		| 'listbox'
		| 'tree'
		| 'grid'
		| 'dialog';
	'aria-hidden'?: ReactiveBoolean;
	'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
	'aria-label'?: string;
	'aria-level'?: number;
	'aria-modal'?: ReactiveBoolean;
	'aria-multiline'?: ReactiveBoolean;
	'aria-multiselectable'?: ReactiveBoolean;
	'aria-orientation'?: 'horizontal' | 'vertical';
	'aria-placeholder'?: string;
	'aria-pressed'?: ReactiveBoolean | 'mixed';
	'aria-readonly'?: ReactiveBoolean;
	'aria-required'?: ReactiveBoolean;
	'aria-selected'?: ReactiveBoolean;
	'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other';
	'aria-valuemax'?: number;
	'aria-valuemin'?: number;
	'aria-valuenow'?: number;
	'aria-valuetext'?: string;

	// Live Region Attributes
	'aria-atomic'?: ReactiveBoolean;
	'aria-busy'?: ReactiveBoolean;
	'aria-live'?: 'off' | 'polite' | 'assertive';
	'aria-relevant'?:
		| 'additions'
		| 'additions removals'
		| 'additions text'
		| 'all'
		| 'removals'
		| 'removals additions'
		| 'removals text'
		| 'text'
		| 'text additions'
		| 'text removals';

	// Drag-and-Drop Attributes
	'aria-dropeffect'?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup';
	'aria-grabbed'?: ReactiveBoolean;

	// Relationship Attributes
	'aria-activedescendant'?: string;
	'aria-colcount'?: number;
	'aria-colindex'?: number;
	'aria-colspan'?: number;
	'aria-controls'?: string;
	'aria-describedby'?: string;
	'aria-details'?: string;
	'aria-flowto'?: string;
	'aria-keyshortcuts'?: string;
	'aria-labelledby'?: string;
	'aria-owns'?: string;
	'aria-posinset'?: number;
	'aria-roledescription'?: string;
	'aria-rowcount'?: number;
	'aria-rowindex'?: number;
	'aria-rowspan'?: number;
	'aria-setsize'?: number;

	// Current State
	'aria-current'?:
		| boolean
		| 'true'
		| 'false'
		| 'page'
		| 'step'
		| 'location'
		| 'date'
		| 'time';

	// Role attribute (WAI-ARIA roles)
	role?:
		| 'alert'
		| 'alertdialog'
		| 'application'
		| 'article'
		| 'banner'
		| 'button'
		| 'cell'
		| 'checkbox'
		| 'columnheader'
		| 'combobox'
		| 'complementary'
		| 'contentinfo'
		| 'definition'
		| 'dialog'
		| 'directory'
		| 'document'
		| 'feed'
		| 'figure'
		| 'form'
		| 'grid'
		| 'gridcell'
		| 'group'
		| 'heading'
		| 'img'
		| 'link'
		| 'list'
		| 'listbox'
		| 'listitem'
		| 'log'
		| 'main'
		| 'marquee'
		| 'math'
		| 'menu'
		| 'menubar'
		| 'menuitem'
		| 'menuitemcheckbox'
		| 'menuitemradio'
		| 'meter'
		| 'navigation'
		| 'none'
		| 'note'
		| 'option'
		| 'presentation'
		| 'progressbar'
		| 'radio'
		| 'radiogroup'
		| 'region'
		| 'row'
		| 'rowgroup'
		| 'rowheader'
		| 'scrollbar'
		| 'search'
		| 'searchbox'
		| 'separator'
		| 'slider'
		| 'spinbutton'
		| 'status'
		| 'switch'
		| 'tab'
		| 'table'
		| 'tablist'
		| 'tabpanel'
		| 'term'
		| 'textbox'
		| 'timer'
		| 'toolbar'
		| 'tooltip'
		| 'tree'
		| 'treegrid'
		| 'treeitem'
		| (string & {});
}
