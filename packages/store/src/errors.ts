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

export class StoreNotFoundError extends Error {
	readonly name = 'StoreNotFoundError';
	constructor(readonly storeName: string) {
		super(`Store "${storeName}" not found`);
	}
}

export class StoreAlreadyExistsError extends Error {
	readonly name = 'StoreAlreadyExistsError';
	constructor(readonly storeName: string) {
		super(`Store "${storeName}" already exists`);
	}
}

export class ActionNotFoundError extends Error {
	readonly name = 'ActionNotFoundError';
	constructor(readonly actionName: string) {
		super(`Action "${actionName}" not found`);
	}
}

export class TimeoutError extends Error {
	readonly name = 'TimeoutError';
	constructor(readonly ms: number) {
		super(`Operation timed out after ${String(ms)}ms`);
	}
}

export class CancellationError extends Error {
	readonly name = 'CancellationError';
	constructor(message = 'Operation was cancelled') {
		super(message);
	}
}

export class ValidationError extends Error {
	readonly name = 'ValidationError';
	constructor(readonly errors: readonly string[]) {
		super(`Validation failed: ${errors.join(', ')}`);
	}
}

export class RaceEmptyError extends Error {
	readonly name = 'RaceEmptyError';
	constructor() {
		super('raceAll requires at least one effect');
	}
}

export class HydrationError extends Error {
	readonly name = 'HydrationError';
	constructor() {
		super('Failed to hydrate stores');
	}
}
