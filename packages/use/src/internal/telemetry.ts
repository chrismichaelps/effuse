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

import {
	trace,
	type Tracer,
	type Span,
	SpanStatusCode,
} from '@opentelemetry/api';
import { Either } from 'effect';

export type UseHooksCategory =
	| 'useWindowSize'
	| 'useLocalStorage'
	| 'useEventListener'
	| 'useMediaQuery'
	| 'useOnline'
	| 'useInterval'
	| 'useDebounce';

export interface UseHooksCategories {
	readonly useWindowSize: boolean;
	readonly useLocalStorage: boolean;
	readonly useEventListener: boolean;
	readonly useMediaQuery: boolean;
	readonly useOnline: boolean;
	readonly useInterval: boolean;
	readonly useDebounce: boolean;
}

export const defaultUseHooksCategories: UseHooksCategories = {
	useWindowSize: true,
	useLocalStorage: true,
	useEventListener: true,
	useMediaQuery: true,
	useOnline: true,
	useInterval: true,
	useDebounce: true,
};

let enabledCategories: UseHooksCategories = { ...defaultUseHooksCategories };

const TRACER_NAME = '@effuse/use';

let cachedTracer: Tracer | null = null;

export const getTracer = (): Tracer => {
	if (!cachedTracer) {
		cachedTracer = trace.getTracer(TRACER_NAME);
	}
	return cachedTracer;
};

export const configureUseHooksTracing = (
	categories: Partial<UseHooksCategories>
): void => {
	enabledCategories = { ...enabledCategories, ...categories };
};

export const isUseHookEnabled = (category: UseHooksCategory): boolean =>
	enabledCategories[category];

export const resetUseHooksTracing = (): void => {
	enabledCategories = { ...defaultUseHooksCategories };
};

export const startSpan = (
	hookName: UseHooksCategory,
	operationName: string,
	attributes?: Record<string, string | number | boolean>
): Span | null => {
	if (!isUseHookEnabled(hookName)) return null;

	const tracer = getTracer();
	const span = tracer.startSpan(`${hookName}.${operationName}`, {
		attributes: {
			'hook.name': hookName,
			'hook.operation': operationName,
			...attributes,
		},
	});

	return span;
};

export const endSpan = (span: Span | null, error?: Error): void => {
	if (!span) return;

	if (error) {
		span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
		span.recordException(error);
	} else {
		span.setStatus({ code: SpanStatusCode.OK });
	}

	span.end();
};

export const withSpan = <T>(
	hookName: UseHooksCategory,
	operationName: string,
	fn: () => T,
	attributes?: Record<string, string | number | boolean>
): T => {
	const span = startSpan(hookName, operationName, attributes);

	return Either.match(Either.try(fn), {
		onLeft: (cause) => {
			const error = cause instanceof Error ? cause : new Error(String(cause));
			endSpan(span, error);
			throw error;
		},
		onRight: (result) => {
			endSpan(span);
			return result;
		},
	});
};

export const recordEvent = (
	hookName: UseHooksCategory,
	eventName: string,
	attributes?: Record<string, string | number | boolean>
): void => {
	if (!isUseHookEnabled(hookName)) return;

	const tracer = getTracer();
	const span = tracer.startSpan(`${hookName}.${eventName}`, {
		attributes: {
			'hook.name': hookName,
			'hook.event': eventName,
			...attributes,
		},
	});

	span.end();
};
