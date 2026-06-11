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

export type ServerTraceKind = 'action' | 'api';

export interface ServerTraceError {
	readonly message: string;
	readonly name?: string;
}

export interface ServerTraceEvent {
	readonly durationMs: number;
	readonly error?: ServerTraceError;
	readonly kind: ServerTraceKind;
	readonly layer?: string;
	readonly method: string;
	readonly ok: boolean;
	readonly path: string;
	readonly route?: string;
	readonly status: number;
	readonly target: string;
	readonly timestamp: number;
}

export interface ServerObservabilityHooks {
	onTrace?: (event: ServerTraceEvent) => void;
	onTraceError?: (error: unknown, event: ServerTraceEvent) => void;
}

export const createServerTraceError = (
	error: unknown
): ServerTraceError => ({
	message: error instanceof Error ? error.message : String(error),
	...(error instanceof Error ? { name: error.name } : {}),
});

export const emitServerTrace = (
	hooks: ServerObservabilityHooks | undefined,
	event: ServerTraceEvent
): void => {
	if (!hooks?.onTrace) return;
	try {
		hooks.onTrace(event);
	} catch (error) {
		try {
			hooks.onTraceError?.(error, event);
		} catch {
			// Telemetry failures should never change server-route behavior.
		}
	}
};
