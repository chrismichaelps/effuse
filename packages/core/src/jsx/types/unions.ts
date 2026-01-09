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

// Input element type attribute
export type InputType =
	| 'text'
	| 'password'
	| 'email'
	| 'number'
	| 'tel'
	| 'url'
	| 'search'
	| 'date'
	| 'time'
	| 'datetime-local'
	| 'month'
	| 'week'
	| 'color'
	| 'file'
	| 'hidden'
	| 'checkbox'
	| 'radio'
	| 'range'
	| 'submit'
	| 'reset'
	| 'button'
	| 'image';

// Button element type attribute
export type ButtonType = 'button' | 'submit' | 'reset';

// Anchor target attribute (allows custom frame names via string & {})
export type AnchorTarget =
	| '_blank'
	| '_self'
	| '_parent'
	| '_top'
	| (string & {});

// Form method attribute
export type FormMethod = 'get' | 'post' | 'dialog';

// Form enctype attribute
export type FormEncType =
	| 'application/x-www-form-urlencoded'
	| 'multipart/form-data'
	| 'text/plain';

// Autocomplete attribute values
export type AutoComplete =
	| 'on'
	| 'off'
	| 'name'
	| 'honorific-prefix'
	| 'given-name'
	| 'additional-name'
	| 'family-name'
	| 'honorific-suffix'
	| 'nickname'
	| 'email'
	| 'username'
	| 'new-password'
	| 'current-password'
	| 'one-time-code'
	| 'organization-title'
	| 'organization'
	| 'street-address'
	| 'address-line1'
	| 'address-line2'
	| 'address-line3'
	| 'address-level4'
	| 'address-level3'
	| 'address-level2'
	| 'address-level1'
	| 'country'
	| 'country-name'
	| 'postal-code'
	| 'cc-name'
	| 'cc-given-name'
	| 'cc-additional-name'
	| 'cc-family-name'
	| 'cc-number'
	| 'cc-exp'
	| 'cc-exp-month'
	| 'cc-exp-year'
	| 'cc-csc'
	| 'cc-type'
	| 'transaction-currency'
	| 'transaction-amount'
	| 'language'
	| 'bday'
	| 'bday-day'
	| 'bday-month'
	| 'bday-year'
	| 'sex'
	| 'tel'
	| 'tel-country-code'
	| 'tel-national'
	| 'tel-area-code'
	| 'tel-local'
	| 'tel-extension'
	| 'impp'
	| 'url'
	| 'photo'
	| (string & {});

// Loading attribute for lazy loading
export type LoadingBehavior = 'eager' | 'lazy';

// Decoding attribute for images
export type DecodingBehavior = 'sync' | 'async' | 'auto';

// Preload attribute for media
export type PreloadBehavior = 'none' | 'metadata' | 'auto' | '';

// Cross-origin attribute
export type CrossOrigin = 'anonymous' | 'use-credentials' | '';

// Text direction
export type TextDirection = 'ltr' | 'rtl' | 'auto';

// Content editable
export type ContentEditable = boolean | 'true' | 'false' | 'inherit';

// Input mode for virtual keyboards
export type InputMode =
	| 'none'
	| 'text'
	| 'decimal'
	| 'numeric'
	| 'tel'
	| 'search'
	| 'email'
	| 'url';

// Enter key hint for virtual keyboards
export type EnterKeyHint =
	| 'enter'
	| 'done'
	| 'go'
	| 'next'
	| 'previous'
	| 'search'
	| 'send';

// Wrap attribute for textarea
export type TextWrap = 'soft' | 'hard' | 'off';

// Table scope attribute
export type TableScope = 'col' | 'colgroup' | 'row' | 'rowgroup';

// Referrer policy
export type ReferrerPolicy =
	| ''
	| 'no-referrer'
	| 'no-referrer-when-downgrade'
	| 'origin'
	| 'origin-when-cross-origin'
	| 'same-origin'
	| 'strict-origin'
	| 'strict-origin-when-cross-origin'
	| 'unsafe-url';

// Autocapitalize
export type AutoCapitalize =
	| 'off'
	| 'none'
	| 'on'
	| 'sentences'
	| 'words'
	| 'characters';

// Popover API
export type PopoverType = '' | 'auto' | 'manual';
export type PopoverTargetAction = 'show' | 'hide' | 'toggle';
