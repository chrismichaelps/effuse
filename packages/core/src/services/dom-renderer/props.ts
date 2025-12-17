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

export interface PropServiceInterface {
	readonly bindProp: (
		element: Element,
		key: string,
		value: unknown
	) => Effect.Effect<PropBindingResult>;

	readonly bindFormControl: (
		element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
		sig: Signal<string | number | boolean>
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
		const stringValue =
			typeof value === 'string' || typeof value === 'number'
				? String(value)
				: '';
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

const bindFormControlImpl = (
	element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
	sig: Signal<string | number | boolean>
): PropBindingResult => {
	const cleanups: (() => void)[] = [];
	const tagName = element.tagName.toLowerCase();
	const inputEl = element as HTMLInputElement;
	const inputType = inputEl.type ? inputEl.type.toLowerCase() : '';

	if (inputType === 'checkbox' || inputType === 'radio') {
		const handler = () => {
			(sig as Signal<boolean>).value = inputEl.checked;
		};
		element.addEventListener('change', handler);
		cleanups.push(() => {
			element.removeEventListener('change', handler);
		});

		const handle: EffectHandle = effect(() => {
			const newVal = Boolean(sig.value);
			if (inputEl.checked !== newVal) {
				inputEl.checked = newVal;
			}
		});
		cleanups.push(handle.stop);
	} else if (tagName === 'select') {
		const handler = () => {
			(sig as Signal<string>).value = element.value;
		};
		element.addEventListener('change', handler);
		cleanups.push(() => {
			element.removeEventListener('change', handler);
		});

		const handle: EffectHandle = effect(() => {
			const newVal = String(sig.value);
			if (element.value !== newVal) {
				element.value = newVal;
			}
		});
		cleanups.push(handle.stop);
	} else {
		const handler = (e: Event) => {
			const target = e.target as HTMLInputElement | HTMLTextAreaElement;
			(sig as Signal<string>).value = target.value;
		};
		element.addEventListener('input', handler);
		cleanups.push(() => {
			element.removeEventListener('input', handler);
		});

		const handle: EffectHandle = effect(() => {
			const newVal = String(sig.value);
			const textEl = element as HTMLInputElement | HTMLTextAreaElement;
			if (textEl.value !== newVal && document.activeElement !== element) {
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

export const PropServiceLive = Layer.succeed(PropService, {
	bindProp: (element: Element, key: string, value: unknown) =>
		Effect.sync(() => {
			if (isSignal(value)) {
				const sig = value as Signal<unknown>;
				const handle: EffectHandle = effect(() => {
					setElementProp(element, key, sig.value);
				});
				return { cleanup: handle.stop };
			}

			setElementProp(element, key, value);
			return { cleanup: () => {} };
		}),

	bindFormControl: (
		element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
		sig: Signal<string | number | boolean>
	) => Effect.sync(() => bindFormControlImpl(element, sig)),
});
