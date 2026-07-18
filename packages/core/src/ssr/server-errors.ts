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

export interface LayerServerErrorOptions<Details = unknown> {
	readonly details?: Details;
	readonly headers?: HeadersInit;
	readonly status?: number;
}

export interface LayerServerErrorBody<
	Code extends string = string,
	Details = unknown,
> {
	readonly error: {
		readonly code: Code;
		readonly details?: Details;
		readonly message: string;
		readonly status: number;
	};
}

const LAYER_SERVER_ERROR: unique symbol = Symbol.for(
	'effuse.layer-server-error'
);

export class LayerServerError<
	Code extends string = string,
	Details = unknown,
> extends Error {
	readonly [LAYER_SERVER_ERROR] = true;
	readonly code: Code;
	readonly details: Details | undefined;
	readonly headers: HeadersInit | undefined;
	readonly status: number;

	constructor(
		code: Code,
		message: string,
		options: LayerServerErrorOptions<Details> = {}
	) {
		super(message);
		this.name = 'LayerServerError';
		this.code = code;
		this.details = options.details;
		this.headers = options.headers;
		this.status = options.status ?? 500;
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

export const createLayerServerErrorBody = <
	Code extends string,
	Details = unknown,
>(
	error: LayerServerError<Code, Details>
): LayerServerErrorBody<Code, Details> => ({
	error: {
		code: error.code,
		...(error.details === undefined ? {} : { details: error.details }),
		message: error.message,
		status: error.status,
	},
});

export const isLayerServerError = (
	error: unknown
): error is LayerServerError =>
	error instanceof LayerServerError ||
	(isRecord(error) &&
		Reflect.get(error, LAYER_SERVER_ERROR) === true &&
		typeof error.code === 'string' &&
		typeof error.message === 'string' &&
		typeof error.status === 'number');

export const isLayerServerErrorBody = (
	value: unknown
): value is LayerServerErrorBody =>
	isRecord(value) &&
	isRecord(value.error) &&
	typeof value.error.code === 'string' &&
	typeof value.error.message === 'string' &&
	typeof value.error.status === 'number';

export const layerServerErrorResponse = <
	Code extends string,
	Details = unknown,
>(
	error: LayerServerError<Code, Details>
): Response =>
	Response.json(createLayerServerErrorBody(error), {
		headers: error.headers,
		status: error.status,
	});
