/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { ErrorCodes } from '../constants/index.js';

export interface ParseErrorProps {
	readonly file: string;
	readonly message: string;
	readonly line?: number;
	readonly column?: number;
}

export class ParseError {
	readonly _tag = 'ParseError' as const;
	readonly code = ErrorCodes.PARSE_ERROR;
	readonly file: string;
	readonly message: string;
	readonly line?: number;
	readonly column?: number;

	static create(props: ParseErrorProps): ParseError {
		return new ParseError(props);
	}

	constructor(props: ParseErrorProps) {
		this.file = props.file;
		this.message = props.message;
		this.line = props.line;
		this.column = props.column;
	}
}

export interface TransformErrorProps {
	readonly file: string;
	readonly message: string;
	readonly nodePath?: string;
	readonly nodeType?: string;
}

export class TransformError {
	readonly _tag = 'TransformError' as const;
	readonly code = ErrorCodes.TRANSFORM_ERROR;
	readonly file: string;
	readonly message: string;
	readonly nodePath?: string;
	readonly nodeType?: string;

	static create(props: TransformErrorProps): TransformError {
		return new TransformError(props);
	}

	constructor(props: TransformErrorProps) {
		this.file = props.file;
		this.message = props.message;
		this.nodePath = props.nodePath;
		this.nodeType = props.nodeType;
	}
}

export interface GenerateErrorProps {
	readonly file: string;
	readonly message: string;
}

export class GenerateError {
	readonly _tag = 'GenerateError' as const;
	readonly code = ErrorCodes.GENERATE_ERROR;
	readonly file: string;
	readonly message: string;

	static create(props: GenerateErrorProps): GenerateError {
		return new GenerateError(props);
	}

	constructor(props: GenerateErrorProps) {
		this.file = props.file;
		this.message = props.message;
	}
}

export interface ConfigErrorProps {
	readonly message: string;
	readonly key?: string;
	readonly expectedType?: string;
	readonly receivedValue?: unknown;
}

export class ConfigError {
	readonly _tag = 'ConfigError' as const;
	readonly code = ErrorCodes.CONFIG_ERROR;
	readonly message: string;
	readonly key?: string;
	readonly expectedType?: string;
	readonly receivedValue?: unknown;

	static create(props: ConfigErrorProps): ConfigError {
		return new ConfigError(props);
	}

	constructor(props: ConfigErrorProps) {
		this.message = props.message;
		this.key = props.key;
		this.expectedType = props.expectedType;
		this.receivedValue = props.receivedValue;
	}
}

export interface CacheErrorProps {
	readonly message: string;
	readonly key?: string;
}

export class CacheError {
	readonly _tag = 'CacheError' as const;
	readonly code = ErrorCodes.CACHE_ERROR;
	readonly message: string;
	readonly key?: string;

	static create(props: CacheErrorProps): CacheError {
		return new CacheError(props);
	}

	constructor(props: CacheErrorProps) {
		this.message = props.message;
		this.key = props.key;
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
