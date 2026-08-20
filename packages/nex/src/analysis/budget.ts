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

/** What a budget said about one request. */
export interface BudgetDecision {
	readonly allowed: boolean;
	/** What is left after the request, or what was left when it was refused. */
	readonly remaining: number;
	/** How long until there would be room, when a refusal can be waited out. */
	readonly retryAfterSeconds?: number | undefined;
}

/** How much a caller may spend, and how quickly it comes back. */
export interface CostBudgetOptions {
	/** The most a caller may hold at once. */
	readonly capacity: number;
	/** How much comes back each second. Zero means it never does. */
	readonly refillPerSecond: number;
	/** Where the time comes from, for tests and for clocks that are not the wall. */
	readonly now?: (() => number) | undefined;
}

/** Decides whether a caller can afford what they are asking for. */
export interface CostBudget {
	/** Charge a caller, and say whether the request may go ahead. */
	readonly take: (caller: string, cost: number) => BudgetDecision;
	/** What a caller has left, without charging them. */
	readonly remaining: (caller: string) => number;
	/** Forget one caller, or all of them. */
	readonly clear: (caller?: string) => void;
}

interface Held {
	remaining: number;
	at: number;
}

/**
 * Spend a caller's budget on what their requests cost.
 *
 * Cost and depth limits say what any one request may be; this says how much a
 * caller may ask for over time, which is the question a server actually has:
 * a thousand cheap requests cost more than one expensive one that was refused.
 *
 * A budget fills back up steadily rather than resetting on a schedule, so a
 * caller that spends carefully is never made to wait for a window to turn
 * over. Nothing is stored per request - one number and one timestamp per
 * caller - and it holds no timers.
 */
export const createCostBudget = (options: CostBudgetOptions): CostBudget => {
	const clock = options.now ?? ((): number => Date.now());
	const held = new Map<string, Held>();

	const settle = (caller: string): Held => {
		const now = clock();
		const already = held.get(caller);

		if (already === undefined) {
			const fresh = { remaining: options.capacity, at: now };
			held.set(caller, fresh);
			return fresh;
		}

		const elapsed = Math.max(now - already.at, 0) / 1000;
		already.remaining = Math.min(
			options.capacity,
			already.remaining + elapsed * options.refillPerSecond
		);
		already.at = now;
		return already;
	};

	return {
		take: (caller, cost) => {
			const state = settle(caller);

			if (state.remaining >= cost) {
				state.remaining -= cost;
				return { allowed: true, remaining: state.remaining };
			}

			const missing = cost - state.remaining;
			const retryAfterSeconds =
				options.refillPerSecond > 0
					? Math.ceil(missing / options.refillPerSecond)
					: undefined;

			return {
				allowed: false,
				remaining: state.remaining,
				...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
			};
		},
		remaining: (caller) => settle(caller).remaining,
		clear: (caller) => {
			if (caller === undefined) held.clear();
			else held.delete(caller);
		},
	};
};
