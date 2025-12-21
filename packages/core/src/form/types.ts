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

import type { Signal, ReadonlySignal } from '../types/index.js';

/** Validation result from a validator function. */
export type ValidationResult = string | undefined;

/** Validator function for a single field. */
export type FieldValidator<T> = (value: T) => ValidationResult;

/** Validation rules per form field. */
export type FormValidators<T extends Record<string, unknown>> = {
	[K in keyof T]?: FieldValidator<T[K]>;
};

/** Validation behavior options. */
export interface FormValidationOptions {
	/** Debounce delay in milliseconds. */
	readonly debounce?: number;
	/** Validation trigger mode. */
	readonly validateOn?: 'change' | 'blur' | 'submit';
}

/** Configuration options for useForm. */
export interface FormOptions<T extends Record<string, unknown>> {
	/** Initial field values as signals. */
	readonly initial: { [K in keyof T]: Signal<T[K]> };
	/** Validator functions per field. */
	readonly validators?: FormValidators<T>;
	/** Submit callback. */
	readonly onSubmit?: (data: T) => void | Promise<void>;
	/** Validation options. */
	readonly validationOptions?: FormValidationOptions;
}

/** Input binding result from bind(). */
export interface BindResult<T> {
	/** Current field value. */
	readonly value: T;
	/** Input event handler. */
	readonly onInput: (e: Event) => void;
	/** Blur event handler. */
	readonly onBlur: () => void;
	/** Field name. */
	readonly name: string;
}

/** Error map keyed by field name. */
export type FormErrors<T extends Record<string, unknown>> = {
	[K in keyof T]?: string;
};

/** Touch state per field. */
export type FormTouched<T extends Record<string, unknown>> = {
	[K in keyof T]: Signal<boolean>;
};

/** Field signals per field name. */
export type FormFields<T extends Record<string, unknown>> = {
	[K in keyof T]: Signal<T[K]>;
};

/** Return type of useForm hook. */
export interface UseFormReturn<T extends Record<string, unknown>> {
	/** Reactive field signals. */
	readonly fields: FormFields<T>;
	/** Reactive error messages. */
	readonly errors: ReadonlySignal<FormErrors<T>>;
	/** Touch state per field. */
	readonly touched: FormTouched<T>;
	/** Form validity state. */
	readonly isValid: ReadonlySignal<boolean>;
	/** Dirty state (any field changed). */
	readonly isDirty: ReadonlySignal<boolean>;
	/** Submission state. */
	readonly isSubmitting: ReadonlySignal<boolean>;
	/** Form submit handler. */
	readonly submit: (e?: Event) => Promise<void>;
	/** Reset to initial values. */
	readonly reset: () => void;
	/** Input binding helper. */
	readonly bind: <K extends keyof T>(name: K) => BindResult<T[K]>;
	/** Set field value. */
	readonly setFieldValue: (name: keyof T, value: T[keyof T]) => void;
	/** Set field error. */
	readonly setFieldError: (name: keyof T, error: string | undefined) => void;
	/** Clear all errors. */
	readonly clearErrors: () => void;
	/** Manual validation trigger. */
	readonly validate: () => boolean;
}
