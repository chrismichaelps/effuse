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

// General query error
export class QueryError extends Data.TaggedError('QueryError')<{
	readonly message: string;
	readonly queryKey: readonly unknown[];
	readonly cause?: unknown;
}> {
	override toString(): string {
		return `QueryError: ${this.message}`;
	}
}

// Network request error
export class NetworkError extends Data.TaggedError('NetworkError')<{
	readonly message: string;
	readonly status?: number | undefined;
	readonly url?: string | undefined;
}> {
	override toString(): string {
		return `NetworkError: ${this.message}${this.status !== undefined ? ` (${String(this.status)})` : ''}`;
	}
}

// Operation timeout error
export class TimeoutError extends Data.TaggedError('TimeoutError')<{
	readonly durationMs: number;
	readonly queryKey?: readonly unknown[] | undefined;
}> {
	override toString(): string {
		return `TimeoutError: Query timed out after ${String(this.durationMs)}ms`;
	}
}

// Operation cancellation error
export class CancellationError extends Data.TaggedError('CancellationError')<{
	readonly reason: string;
	readonly queryKey?: readonly unknown[];
}> {
	override toString(): string {
		return `CancellationError: ${this.reason}`;
	}
}

// Mutation operation error
export class MutationError extends Data.TaggedError('MutationError')<{
	readonly message: string;
	readonly mutationKey?: readonly unknown[] | undefined;
	readonly cause?: unknown | undefined;
}> {
	override toString(): string {
		return `MutationError: ${this.message}`;
	}
}
