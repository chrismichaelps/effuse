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

import { Context, Effect, Layer } from 'effect';
import type { Signal } from '../../reactivity/signal.js';
import { isSignal } from '../../reactivity/signal.js';
import { effect } from '../../effects/effect.js';
import type { EffectHandle } from '../../types/index.js';

export interface PropBindingResult {
	cleanup: () => void;
}

type FormValue = string | number | boolean;
type FormValueSource = Signal<FormValue> | (() => FormValue);

export interface PropServiceInterface {
	readonly bindProp: (
		element: Element,
		key: string,
		value: unknown
	) => Effect.Effect<PropBindingResult>;

	readonly bindFormControl: (
		element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
		source: FormValueSource
	) => Effect.Effect<PropBindingResult>;
}

export class PropService extends Context.Tag('effuse/PropService')<
	PropService,
	PropServiceInterface
>() {}

const setElementProp = (
	element: Element,
	key: string,
	value: unknown
): void => {
	if (key === 'class' || key === 'className') {
		if (typeof value === 'string') {
			element.className = value;
		} else if (value == null) {
			element.className = '';
		}
		return;
	}

	if (key === 'style') {
		if (typeof value === 'object' && value !== null) {
			const el = element as HTMLElement;
			const styles = value as Record<string, string | number>;
			for (const [prop, val] of Object.entries(styles)) {
				const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
				el.style.setProperty(cssProp, String(val));
			}
		}
		return;
	}

	if (key === 'value') {
		const inputEl = element as HTMLInputElement | HTMLTextAreaElement;
		let stringValue = '';
		if (typeof value === 'string') {
			stringValue = value;
		} else if (typeof value === 'number') {
			stringValue = String(value);
		}
		if (inputEl.value !== stringValue) {
			inputEl.value = stringValue;
		}
		return;
	}

	if (key === 'checked') {
		(element as HTMLInputElement).checked = Boolean(value);
		return;
	}

	if (typeof value === 'boolean') {
		if (value) {
			element.setAttribute(key, '');
		} else {
			element.removeAttribute(key);
		}
		return;
	}

	if (value == null) {
		element.removeAttribute(key);
	} else if (typeof value === 'string' || typeof value === 'number') {
		element.setAttribute(key, String(value));
	}
};

const getValue = (source: FormValueSource): FormValue => {
	if (isSignal(source)) {
		return (source as Signal<FormValue>).value;
	}
	return (source as () => FormValue)();
};

const bindFormControlImpl = (
	element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
	source: FormValueSource
): PropBindingResult => {
	const cleanups: (() => void)[] = [];
	const tagName = element.tagName.toLowerCase();
	const inputEl = element as HTMLInputElement;
	const inputType = inputEl.type ? inputEl.type.toLowerCase() : '';

	if (inputType === 'checkbox' || inputType === 'radio') {
		const handle: EffectHandle = effect(() => {
			const newVal = Boolean(getValue(source));
			if (inputEl.checked !== newVal) {
				inputEl.checked = newVal;
			}
		});
		cleanups.push(handle.stop);
	} else if (tagName === 'select') {
		const handle: EffectHandle = effect(() => {
			const newVal = String(getValue(source));
			if (element.value !== newVal) {
				element.value = newVal;
			}
		});
		cleanups.push(handle.stop);
	} else {
		const textEl = element as HTMLInputElement | HTMLTextAreaElement;
		const handle: EffectHandle = effect(() => {
			const newVal = String(getValue(source));
			if (textEl.value !== newVal) {
				textEl.value = newVal;
			}
		});
		cleanups.push(handle.stop);
	}

	return {
		cleanup: () => {
			for (const fn of cleanups) {
				fn();
			}
		},
	};
};

const isEventHandler = (key: string): boolean => {
	if (key.length <= 2 || !key.startsWith('on')) return false;
	const thirdChar = key[2];
	return thirdChar !== undefined && thirdChar === thirdChar.toUpperCase();
};

const isCompilerGetter = (value: unknown): value is () => unknown => {
	return typeof value === 'function' && value.length === 0;
};

export const PropServiceLive = Layer.succeed(PropService, {
	bindProp: (element: Element, key: string, value: unknown) =>
		Effect.sync(() => {
			if (isEventHandler(key)) {
				if (typeof value === 'function') {
					const handler = value as EventListener;
					const eventName = key.slice(2).toLowerCase();
					element.addEventListener(eventName, handler);
					return {
						cleanup: () => {
							element.removeEventListener(eventName, handler);
						},
					};
				}
				return {
					cleanup: () => {
						/*  */
					},
				};
			}

			if (isSignal(value)) {
				const sig = value;
				const handle: EffectHandle = effect(() => {
					setElementProp(element, key, sig.value);
				});
				return { cleanup: handle.stop };
			}

			if (isCompilerGetter(value)) {
				const getter = value;
				const handle: EffectHandle = effect(() => {
					const computedValue = getter();
					setElementProp(element, key, computedValue);
				});
				return { cleanup: handle.stop };
			}

			setElementProp(element, key, value);
			return { cleanup: () => {} };
		}),

	bindFormControl: (
		element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
		source: FormValueSource
	) => Effect.sync(() => bindFormControlImpl(element, source)),
});
