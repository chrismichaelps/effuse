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

import { Predicate } from 'effect';
import type { QueryHandlerDeps, SubscribeInput } from './types.js';

export const addSubscriber = (
	deps: QueryHandlerDeps,
	input: SubscribeInput
): (() => void) => {
	const { internals } = deps;
	let subs = internals.subscribers.get(input.keyStr);
	if (!subs) {
		subs = new Set();
		internals.subscribers.set(input.keyStr, subs);
	}
	subs.add(input.callback);
	return () => {
		const subsSet = internals.subscribers.get(input.keyStr);
		if (Predicate.isNotNullable(subsSet)) {
			subsSet.delete(input.callback);
			if (subsSet.size === 0) {
				internals.subscribers.delete(input.keyStr);
			}
		}
	};
};
