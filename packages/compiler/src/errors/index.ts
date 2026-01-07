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
import { ErrorCodes } from '../constants/index.js';

export interface ParseErrorProps {
	readonly file: string;
	readonly message: string;
	readonly line?: number;
	readonly column?: number;
}

export class ParseError extends Data.TaggedError('ParseError')<{
	readonly code: typeof ErrorCodes.PARSE_ERROR;
	readonly file: string;
	readonly message: string;
	readonly line?: number;
	readonly column?: number;
}> {
	static create(props: ParseErrorProps): ParseError {
		return new ParseError({ ...props, code: ErrorCodes.PARSE_ERROR });
	}
}

export interface TransformErrorProps {
	readonly file: string;
	readonly message: string;
	readonly nodePath?: string;
	readonly nodeType?: string;
}

export class TransformError extends Data.TaggedError('TransformError')<{
	readonly code: typeof ErrorCodes.TRANSFORM_ERROR;
	readonly file: string;
	readonly message: string;
	readonly nodePath?: string;
	readonly nodeType?: string;
}> {
	static create(props: TransformErrorProps): TransformError {
		return new TransformError({ ...props, code: ErrorCodes.TRANSFORM_ERROR });
	}
}

export interface GenerateErrorProps {
	readonly file: string;
	readonly message: string;
}

export class GenerateError extends Data.TaggedError('GenerateError')<{
	readonly code: typeof ErrorCodes.GENERATE_ERROR;
	readonly file: string;
	readonly message: string;
}> {
	static create(props: GenerateErrorProps): GenerateError {
		return new GenerateError({ ...props, code: ErrorCodes.GENERATE_ERROR });
	}
}

export interface ConfigErrorProps {
	readonly message: string;
	readonly key?: string;
	readonly expectedType?: string;
	readonly receivedValue?: unknown;
}

export class ConfigError extends Data.TaggedError('ConfigError')<{
	readonly code: typeof ErrorCodes.CONFIG_ERROR;
	readonly message: string;
	readonly key?: string;
	readonly expectedType?: string;
	readonly receivedValue?: unknown;
}> {
	static create(props: ConfigErrorProps): ConfigError {
		return new ConfigError({ ...props, code: ErrorCodes.CONFIG_ERROR });
	}
}

export interface CacheErrorProps {
	readonly message: string;
	readonly key?: string;
}

export class CacheError extends Data.TaggedError('CacheError')<{
	readonly code: typeof ErrorCodes.CACHE_ERROR;
	readonly message: string;
	readonly key?: string;
}> {
	static create(props: CacheErrorProps): CacheError {
		return new CacheError({ ...props, code: ErrorCodes.CACHE_ERROR });
	}
}

export type CompilerError =
	| ParseError
	| TransformError
	| GenerateError
	| ConfigError
	| CacheError;

export const isParseError = (error: unknown): error is ParseError =>
	error instanceof ParseError;

export const isTransformError = (error: unknown): error is TransformError =>
	error instanceof TransformError;

export const isGenerateError = (error: unknown): error is GenerateError =>
	error instanceof GenerateError;

export const isConfigError = (error: unknown): error is ConfigError =>
	error instanceof ConfigError;

export const isCacheError = (error: unknown): error is CacheError =>
	error instanceof CacheError;

export const isCompilerError = (error: unknown): error is CompilerError =>
	isParseError(error) ||
	isTransformError(error) ||
	isGenerateError(error) ||
	isConfigError(error) ||
	isCacheError(error);

export const formatError = (error: CompilerError): string => {
	const prefix = `[${error.code}]`;

	switch (error._tag) {
		case 'ParseError': {
			const loc =
				error.line !== undefined
					? `:${error.line}${error.column !== undefined ? `:${error.column}` : ''}`
					: '';
			return `${prefix} ${error.file}${loc}: ${error.message}`;
		}
		case 'TransformError':
			return `${prefix} ${error.file}: ${error.message}${error.nodeType ? ` (${error.nodeType})` : ''}`;
		case 'GenerateError':
			return `${prefix} ${error.file}: ${error.message}`;
		case 'ConfigError':
			return `${prefix} ${error.key ? `${error.key}: ` : ''}${error.message}`;
		case 'CacheError':
			return `${prefix} ${error.key ? `${error.key}: ` : ''}${error.message}`;
	}
};
