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

const EVENT_PREFIX = 'on';

/**
 * Whether a prop name is an event handler, such as `onClick`.
 *
 * The prefix alone is not enough: the character after it must start a new
 * word, so `once`, `online`, and `onboarded` are ordinary props. The character
 * must also be a *letter*, because `toUpperCase()` leaves digits, `-`, `_` and
 * `$` unchanged and a test for "unchanged by toUpperCase" therefore accepts
 * them — which sent `on-click` to `addEventListener` as an event named
 * `-click`.
 *
 * Every call site imports this. The rule previously existed in four copies
 * inside this package, three of which disagreed, and the disagreement was
 * invisible: a prop routed to the wrong branch registers a listener for an
 * event that never fires, or drops an attribute, without reporting anything.
 * The compiler applies the same rule when deciding whether to wrap a binding,
 * so the two have to match — one decides whether a binding is reactive, the
 * other how it is applied.
 */
export const isEventHandlerName = (key: string): boolean => {
	if (key.length <= EVENT_PREFIX.length || !key.startsWith(EVENT_PREFIX)) {
		return false;
	}

	const boundary = key[EVENT_PREFIX.length];
	if (boundary === undefined) return false;

	return (
		boundary !== boundary.toLowerCase() && boundary === boundary.toUpperCase()
	);
};

/** The DOM event name a handler prop binds to, e.g. `onClick` to `click`. */
export const eventNameFromProp = (key: string): string =>
	key.slice(EVENT_PREFIX.length).toLowerCase();
