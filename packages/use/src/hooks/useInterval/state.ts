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

import { Data } from 'effect';
import type {
	TaggedEnumConstructors,
	TaggedUnion,
} from '../../internal/tagged.js';

type IntervalStateCases = {
	readonly Stopped: Record<never, never>;
	readonly Running: { readonly count: number };
	readonly Paused: { readonly count: number };
};

export type IntervalState = TaggedUnion<IntervalStateCases>;

export const IntervalState = Data.taggedEnum<IntervalState>() as unknown as
	TaggedEnumConstructors<IntervalStateCases>;

export const isStopped = IntervalState.$is('Stopped');
export const isRunning = IntervalState.$is('Running');
export const isPaused = IntervalState.$is('Paused');

export const matchIntervalState = IntervalState.$match;

export const getCount = (state: IntervalState): number =>
	matchIntervalState(state, {
		Stopped: () => 0,
		Running: ({ count }) => count,
		Paused: ({ count }) => count,
	});

export type IntervalStatus = 'running' | 'paused' | 'stopped';

export const getStatus = (state: IntervalState): IntervalStatus =>
	matchIntervalState(state, {
		Stopped: () => 'stopped' as const,
		Running: () => 'running' as const,
		Paused: () => 'paused' as const,
	});

export const getIsActive = (state: IntervalState): boolean =>
	matchIntervalState(state, {
		Stopped: () => false,
		Running: () => true,
		Paused: () => false,
	});
