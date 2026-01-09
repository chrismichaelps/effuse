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

import type { Directive } from './types.js';

const directiveRegistry = new Map<string, Directive>();

export function registerDirective<T extends Element, P>(
	name: string,
	fn: Directive<T, P>
): void {
	directiveRegistry.set(name, fn as Directive);
}

export function getDirective(name: string): Directive | undefined {
	return directiveRegistry.get(name);
}

export function hasDirective(name: string): boolean {
	return directiveRegistry.has(name);
}

export function unregisterDirective(name: string): boolean {
	return directiveRegistry.delete(name);
}

export function applyDirective(
	name: string,
	element: Element,
	accessor: () => unknown
): (() => void) | undefined {
	const directive = directiveRegistry.get(name);
	if (directive) {
		return directive(element, accessor);
	}
	return undefined;
}

export function getDirectiveNames(): string[] {
	return Array.from(directiveRegistry.keys());
}
