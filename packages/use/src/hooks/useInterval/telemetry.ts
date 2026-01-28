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

import { startSpan, recordEvent } from '../../internal/telemetry.js';

const HOOK_NAME = 'useInterval' as const;

export const traceIntervalInit = (
	delay: number,
	immediate: boolean
): ReturnType<typeof startSpan> => {
	return startSpan(HOOK_NAME, 'init', {
		'interval.delay': delay,
		'interval.immediate': immediate,
	});
};

export const traceIntervalStart = (delay: number): void => {
	recordEvent(HOOK_NAME, 'start', {
		'interval.delay': delay,
	});
};

export const traceIntervalTick = (count: number): void => {
	recordEvent(HOOK_NAME, 'tick', {
		'interval.count': count,
	});
};

export const traceIntervalPause = (): void => {
	recordEvent(HOOK_NAME, 'pause');
};

export const traceIntervalResume = (): void => {
	recordEvent(HOOK_NAME, 'resume');
};

export const traceIntervalStop = (): void => {
	recordEvent(HOOK_NAME, 'stop');
};
