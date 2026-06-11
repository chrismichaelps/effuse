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

import type { CompiledLayer } from '../layers/api/defineLayer.js';
import type { EffuseLayer, ServerResult } from '../layers/types.js';
import { EFFUSE_ACTION_PREFIX } from './server-routing.js';

export type LayerActionResponseMode = 'auto' | 'json' | 'text' | 'response';

export interface LayerActionCallOptions
	extends Omit<RequestInit, 'body' | 'method'> {
	readonly baseUrl?: string | URL;
	readonly fetch?: typeof fetch;
	readonly response?: LayerActionResponseMode;
}

type AnyCompiledLayer = CompiledLayer<EffuseLayer>;

export type LayerActionsFrom<L extends AnyCompiledLayer> =
	L extends CompiledLayer<infer T>
		? T extends {
				readonly server?: { readonly actions?: infer Actions };
			}
			? NonNullable<Actions>
			: never
		: never;

export type LayerActionName<L extends AnyCompiledLayer> = Extract<
	keyof LayerActionsFrom<L>,
	string
>;

type LayerActionHandler<
	L extends AnyCompiledLayer,
	Name extends LayerActionName<L>,
> = LayerActionsFrom<L>[Name];

type LayerActionHandlerResult<Handler> = Handler extends (
	ctx: infer _Context
) => infer Result
	? Awaited<Result>
	: never;

type LayerActionPayload<Result> =
	Result extends Response
		? unknown
		: Result extends BodyInit
			? unknown
			: Result extends null | undefined
				? undefined
				: Result extends ServerResult
					? Result
					: unknown;

export type LayerActionResult<
	L extends AnyCompiledLayer,
	Name extends LayerActionName<L>,
> = LayerActionPayload<LayerActionHandlerResult<LayerActionHandler<L, Name>>>;

export type LayerActionClient<L extends AnyCompiledLayer> = {
	readonly [Name in LayerActionName<L>]: (
		input?: unknown,
		options?: LayerActionCallOptions
	) => Promise<LayerActionResult<L, Name>>;
};

export class LayerActionError extends Error {
	readonly status: number;
	readonly statusText: string;
	readonly body: string;
	readonly response: Response;

	constructor(response: Response, body: string) {
		super(
			`Effuse action failed with ${String(response.status)} ${response.statusText}`
		);
		this.name = 'LayerActionError';
		this.status = response.status;
		this.statusText = response.statusText;
		this.body = body;
		this.response = response;
	}
}

const encodeActionSegment = (value: string): string => encodeURIComponent(value);

const BASE_URL_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/)/i;

const isBaseUrlArgument = (value: string | URL | undefined): boolean =>
	value instanceof URL ||
	(typeof value === 'string' && BASE_URL_PATTERN.test(value));

const resolveActionLayerName = (
	layer: string | { readonly name: string }
): string => (typeof layer === 'string' ? layer : layer.name);

export function createLayerActionPath(action: string): string;
export function createLayerActionPath(
	layer: string | { readonly name: string },
	action: string
): string;
export function createLayerActionPath(
	layerOrAction: string | { readonly name: string },
	action?: string
): string {
	if (action === undefined) {
		return `${EFFUSE_ACTION_PREFIX}${encodeActionSegment(
			resolveActionLayerName(layerOrAction)
		)}`;
	}

	return `${EFFUSE_ACTION_PREFIX}${encodeActionSegment(
		resolveActionLayerName(layerOrAction)
	)}/${encodeActionSegment(action)}`;
}

export function createLayerActionUrl(
	action: string,
	baseUrl?: string | URL
): string;
export function createLayerActionUrl(
	layer: string | { readonly name: string },
	action: string,
	baseUrl?: string | URL
): string;
export function createLayerActionUrl(
	layerOrAction: string | { readonly name: string },
	actionOrBaseUrl?: string | URL,
	maybeBaseUrl?: string | URL
): string {
	const hasLayer =
		typeof actionOrBaseUrl === 'string' &&
		(typeof layerOrAction !== 'string' ||
			maybeBaseUrl !== undefined ||
			!isBaseUrlArgument(actionOrBaseUrl));
	const path = hasLayer
		? createLayerActionPath(layerOrAction, actionOrBaseUrl)
		: createLayerActionPath(resolveActionLayerName(layerOrAction));
	const baseUrl = hasLayer ? maybeBaseUrl : actionOrBaseUrl;

	return baseUrl ? new URL(path, baseUrl).toString() : path;
}

const isBodyPayload = (value: unknown): value is BodyInit =>
	typeof value === 'string' ||
	value instanceof Blob ||
	value instanceof FormData ||
	value instanceof URLSearchParams ||
	value instanceof ArrayBuffer ||
	ArrayBuffer.isView(value) ||
	value instanceof ReadableStream;

const mergeHeaders = (
	base: HeadersInit | undefined,
	override: HeadersInit | undefined
): Headers => {
	const headers = new Headers(base);
	if (override) {
		new Headers(override).forEach((value, key) => {
			headers.set(key, value);
		});
	}
	return headers;
};

const mergeOptions = (
	base: LayerActionCallOptions | undefined,
	override: LayerActionCallOptions | undefined
): LayerActionCallOptions => ({
	...base,
	...override,
	headers: mergeHeaders(base?.headers, override?.headers),
});

const createRequestInit = (
	input: unknown,
	options: LayerActionCallOptions
): RequestInit => {
	const headers = new Headers(options.headers);
	const requestInit: RequestInit = {
		...options,
		method: 'POST',
		headers,
	};
	delete (requestInit as { fetch?: unknown }).fetch;
	delete (requestInit as { baseUrl?: unknown }).baseUrl;
	delete (requestInit as { response?: unknown }).response;

	if (input === undefined) {
		return requestInit;
	}

	if (isBodyPayload(input)) {
		return { ...requestInit, body: input };
	}

	if (!headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	return {
		...requestInit,
		body: JSON.stringify(input),
	};
};

const readActionResponse = async <Result>(
	response: Response,
	mode: LayerActionResponseMode = 'auto'
): Promise<Result> => {
	if (!response.ok) {
		const body = await response
			.clone()
			.text()
			.catch(() => '');
		throw new LayerActionError(response, body);
	}

	if (mode === 'response') {
		return response as Result;
	}

	if (response.status === 204) {
		return undefined as Result;
	}

	if (mode === 'text') {
		return (await response.text()) as Result;
	}

	if (
		mode === 'json' ||
		response.headers.get('Content-Type')?.includes('application/json')
	) {
		return (await response.json()) as Result;
	}

	return (await response.text()) as Result;
};

export function callLayerAction<
	L extends AnyCompiledLayer,
	Name extends LayerActionName<L>,
>(
	layer: L,
	action: Name,
	input?: unknown,
	options?: LayerActionCallOptions
): Promise<LayerActionResult<L, Name>>;
export function callLayerAction<Result = unknown>(
	action: string,
	input?: unknown,
	options?: LayerActionCallOptions
): Promise<Result>;
export async function callLayerAction<Result = unknown>(
	layerOrAction: string | AnyCompiledLayer,
	actionOrInput?: unknown,
	inputOrOptions?: unknown,
	maybeOptions?: LayerActionCallOptions
): Promise<Result> {
	const hasLayer = typeof layerOrAction !== 'string';
	const action = hasLayer ? actionOrInput : layerOrAction;
	if (typeof action !== 'string') {
		throw new TypeError('Effuse layer action name must be a string.');
	}

	const options = (hasLayer ? maybeOptions : inputOrOptions) as
		| LayerActionCallOptions
		| undefined;
	const input = hasLayer ? inputOrOptions : actionOrInput;
	const fetcher = options?.fetch ?? fetch;
	const url = hasLayer
		? createLayerActionUrl(layerOrAction, action, options?.baseUrl)
		: createLayerActionUrl(action, options?.baseUrl);

	const response = await fetcher(url, createRequestInit(input, options ?? {}));
	return readActionResponse<Result>(response, options?.response);
}

export const createLayerActionClient = <L extends AnyCompiledLayer>(
	layer: L,
	options?: LayerActionCallOptions
): LayerActionClient<L> =>
	new Proxy(
		{},
		{
			get: (_target, property) => {
				if (typeof property !== 'string') {
					return undefined;
				}

				return (input?: unknown, callOptions?: LayerActionCallOptions) =>
					callLayerAction(
						layer,
						property as LayerActionName<L>,
						input,
						mergeOptions(options, callOptions)
					);
			},
		}
	) as LayerActionClient<L>;
