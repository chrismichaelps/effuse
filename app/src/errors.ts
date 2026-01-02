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

import { TaggedError } from '@effuse/core';

export class NetworkError extends TaggedError('NetworkError')<{
	readonly message: string;
	readonly url: string;
	readonly status?: number;
	readonly cause?: unknown;
}> {
	override toString(): string {
		const statusPart = this.status !== undefined ? ` (${this.status})` : '';
		return `${this._tag}${statusPart}: ${this.message} - ${this.url}`;
	}
}

export class ApiError extends TaggedError('ApiError')<{
	readonly message: string;
	readonly endpoint: string;
	readonly statusCode: number;
	readonly body?: unknown;
}> {
	override toString(): string {
		return `${this._tag} [${this.statusCode}] ${this.endpoint}: ${this.message}`;
	}

	override toJSON(): Record<string, unknown> {
		return {
			_tag: this._tag,
			message: this.message,
			endpoint: this.endpoint,
			statusCode: this.statusCode,
			body: this.body,
		};
	}
}

export class TodoError extends TaggedError('TodoError')<{
	readonly message: string;
	readonly operation: 'fetch' | 'add' | 'update' | 'delete' | 'toggle';
	readonly todoId?: number;
	readonly cause?: unknown;
}> {
	override toString(): string {
		const idPart = this.todoId !== undefined ? ` (id: ${this.todoId})` : '';
		return `${this._tag} [${this.operation}]${idPart}: ${this.message}`;
	}
}

export class FormSubmissionError extends TaggedError('FormSubmissionError')<{
	readonly message: string;
	readonly formId?: string;
	readonly field?: string;
	readonly cause?: unknown;
}> {
	override toString(): string {
		const fieldPart = this.field !== undefined ? ` (field: ${this.field})` : '';
		return `${this._tag}${fieldPart}: ${this.message}`;
	}
}

export type AppError =
	| NetworkError
	| ApiError
	| TodoError
	| FormSubmissionError;
