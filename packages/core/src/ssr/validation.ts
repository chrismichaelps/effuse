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

export type ServerValidationSource =
	| 'body'
	| 'formData'
	| 'headers'
	| 'json'
	| 'params'
	| 'query'
	| 'value';

export interface ServerValidationIssue {
	readonly code?: string;
	readonly message: string;
	readonly path?: string;
}

export interface ServerValidationSuccess<T> {
	readonly success: true;
	readonly data: T;
}

export interface ServerValidationFailure {
	readonly success: false;
	readonly error?: unknown;
	readonly issues?: readonly unknown[];
}

export type ServerValidationResult<T> =
	| ServerValidationSuccess<T>
	| ServerValidationFailure;

export type ServerValidator<T> =
	| ((value: unknown) => T | ServerValidationResult<T>)
	| {
			validateSync: (value: unknown, context?: string) => T;
	  }
	| {
			parse: (value: unknown) => T;
	  }
	| {
			safeParse: (value: unknown) => ServerValidationResult<T>;
	  };

export interface ServerValidationErrorBody {
	readonly error: {
		readonly code: 'EFFUSE_VALIDATION_FAILED';
		readonly issues: readonly ServerValidationIssue[];
		readonly message: string;
		readonly source: ServerValidationSource;
	};
}

export interface ServerValidationHelpers {
	value: <T>(
		source: ServerValidationSource,
		value: unknown,
		validator: ServerValidator<T>
	) => T;
	json: <T>(validator: ServerValidator<T>) => Promise<T>;
	formData: <T>(validator: ServerValidator<T>) => Promise<T>;
	headers: <T>(validator: ServerValidator<T>) => T;
	params: <T>(validator: ServerValidator<T>) => T;
	query: <T>(validator: ServerValidator<T>) => T;
}

export class ServerValidationError extends Error {
	readonly issues: readonly ServerValidationIssue[];
	readonly source: ServerValidationSource;
	readonly status = 400;

	constructor(
		source: ServerValidationSource,
		issues: readonly ServerValidationIssue[],
		message = 'Request validation failed.'
	) {
		super(message);
		this.name = 'ServerValidationError';
		this.source = source;
		this.issues = issues;
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const pathToString = (path: unknown): string | undefined => {
	if (typeof path === 'string') {
		return path;
	}
	if (Array.isArray(path) && path.length > 0) {
		return path.map(String).join('.');
	}
	return undefined;
};

const normalizeIssue = (issue: unknown): ServerValidationIssue => {
	if (isRecord(issue) && typeof issue.message === 'string') {
		const normalized: ServerValidationIssue = {
			message: issue.message,
		};
		const code = issue.code;
		const path = pathToString(issue.path);
		return {
			...normalized,
			...(typeof code === 'string' ? { code } : {}),
			...(path ? { path } : {}),
		};
	}

	return { message: String(issue) };
};

const normalizeIssues = (
	issues: readonly unknown[] | undefined
): readonly ServerValidationIssue[] =>
	issues && issues.length > 0
		? issues.map((issue) => normalizeIssue(issue))
		: [{ message: 'Invalid request value.' }];

const normalizeErrorIssues = (
	error: unknown
): readonly ServerValidationIssue[] => {
	if (isRecord(error) && Array.isArray(error.issues)) {
		return normalizeIssues(error.issues);
	}
	if (
		isRecord(error) &&
		typeof error.message === 'string' &&
		typeof error.propName === 'string'
	) {
		return [{ message: error.message, path: error.propName }];
	}
	if (error instanceof Error) {
		return [{ message: error.message }];
	}
	if (typeof error === 'string') {
		return [{ message: error }];
	}
	return normalizeIssues(undefined);
};

const isValidationResult = <T>(
	value: unknown
): value is ServerValidationResult<T> =>
	isRecord(value) && typeof value.success === 'boolean';

const validatorResult = <T>(
	value: unknown,
	validator: ServerValidator<T>
): T | ServerValidationResult<T> => {
	if (typeof validator === 'function') {
		return validator(value);
	}
	if ('validateSync' in validator) {
		return validator.validateSync(value, 'server request');
	}

	if ('safeParse' in validator) {
		return validator.safeParse(value);
	}

	return validator.parse(value);
};

export const validateServerValue = <T>(
	source: ServerValidationSource,
	value: unknown,
	validator: ServerValidator<T>
): T => {
	try {
		const result = validatorResult(value, validator);
		if (isValidationResult<T>(result)) {
			if (result.success) {
				return result.data;
			}
			throw new ServerValidationError(
				source,
				Array.isArray(result.issues)
					? normalizeIssues(result.issues)
					: normalizeErrorIssues(result.error)
			);
		}
		return result;
	} catch (error) {
		if (error instanceof ServerValidationError) {
			throw error;
		}
		throw new ServerValidationError(source, normalizeErrorIssues(error));
	}
};

export const isServerValidationError = (
	error: unknown
): error is ServerValidationError => error instanceof ServerValidationError;

export const createServerValidationErrorBody = (
	error: ServerValidationError
): ServerValidationErrorBody => ({
	error: {
		code: 'EFFUSE_VALIDATION_FAILED',
		issues: error.issues,
		message: error.message,
		source: error.source,
	},
});

export const isServerValidationErrorBody = (
	value: unknown
): value is ServerValidationErrorBody =>
	isRecord(value) &&
	isRecord(value.error) &&
	value.error.code === 'EFFUSE_VALIDATION_FAILED' &&
	Array.isArray(value.error.issues) &&
	typeof value.error.message === 'string' &&
	typeof value.error.source === 'string';

export const serverValidationErrorResponse = (
	error: ServerValidationError
): Response =>
	Response.json(createServerValidationErrorBody(error), {
		status: error.status,
	});

const headersToRecord = (headers: Headers): Record<string, string> => {
	const record: Record<string, string> = {};
	headers.forEach((value, key) => {
		record[key] = value;
	});
	return record;
};

type FormDataRecordValue =
	| FormDataEntryValue
	| readonly FormDataEntryValue[];

const isFormDataRecordArray = (
	value: FormDataRecordValue | undefined
): value is readonly FormDataEntryValue[] => Array.isArray(value);

const formDataToRecord = (
	formData: FormData
): Record<string, FormDataRecordValue> => {
	const record: Partial<Record<string, FormDataRecordValue>> = {};
	formData.forEach((value, key) => {
		const current = record[key];
		if (current === undefined) {
			record[key] = value;
			return;
		}
		record[key] = isFormDataRecordArray(current)
			? [...current, value]
			: [current, value];
	});
	return record as Record<string, FormDataRecordValue>;
};

export const createServerValidationHelpers = (
	request: Request,
	params: Record<string, string>,
	query: Record<string, string>
): ServerValidationHelpers => ({
	value: (source, value, validator) =>
		validateServerValue(source, value, validator),
	json: async (validator) => {
		let value: unknown;
		try {
			value = await request.json();
		} catch {
			throw new ServerValidationError('json', [
				{ code: 'invalid_json', message: 'Invalid JSON body.' },
			]);
		}
		return validateServerValue('json', value, validator);
	},
	formData: async (validator) =>
		validateServerValue(
			'formData',
			formDataToRecord(await request.formData()),
			validator
		),
	headers: (validator) =>
		validateServerValue('headers', headersToRecord(request.headers), validator),
	params: (validator) => validateServerValue('params', params, validator),
	query: (validator) => validateServerValue('query', query, validator),
});
