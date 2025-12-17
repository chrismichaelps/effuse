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

import { Effect, Context, Layer, pipe } from 'effect';
import type { EffuseChild } from '@effuse/core';
import type { ComponentMap } from '../renderer/transformer.js';
import type { DocumentNode } from '../types/ast.js';
import type {
	ParseError,
	TransformError,
	SanitizationError,
} from '../types/errors.js';
import { type InkError } from '../types/errors.js';
import { ParserService, ParserServiceLive } from './ParserService.js';
import {
	TransformerService,
	TransformerServiceLive,
} from './TransformerService.js';
import { SanitizerService, SanitizerServiceLive } from './SanitizerService.js';

export interface InkServiceInterface {
	readonly parse: (
		input: string
	) => Effect.Effect<DocumentNode, ParseError | SanitizationError>;
	readonly transform: (
		doc: DocumentNode,
		components: ComponentMap
	) => Effect.Effect<EffuseChild[], TransformError>;
	readonly render: (
		input: string,
		components: ComponentMap
	) => Effect.Effect<EffuseChild[], InkError>;
}

export class InkService extends Context.Tag('ink/InkService')<
	InkService,
	InkServiceInterface
>() {}

const make = Effect.gen(function* () {
	const parser = yield* ParserService;
	const transformer = yield* TransformerService;
	const sanitizer = yield* SanitizerService;

	const service: InkServiceInterface = {
		parse: (input: string) =>
			pipe(
				sanitizer.sanitize(input),
				Effect.flatMap((clean) => parser.parseMarkdown(clean))
			),

		transform: (doc: DocumentNode, components: ComponentMap) =>
			transformer.transform(doc, components),

		render: (input: string, components: ComponentMap) =>
			pipe(
				sanitizer.sanitize(input),
				Effect.flatMap((clean) => parser.parseMarkdown(clean)),
				Effect.flatMap((doc) => transformer.transform(doc, components))
			),
	};

	return service;
});

export const InkServiceLive = Layer.effect(InkService, make).pipe(
	Layer.provide(ParserServiceLive),
	Layer.provide(TransformerServiceLive),
	Layer.provide(SanitizerServiceLive)
);

export const renderMarkdown = (
	input: string,
	components: ComponentMap = {}
): Effect.Effect<EffuseChild[], InkError, InkService> =>
	Effect.gen(function* () {
		const ink = yield* InkService;
		return yield* ink.render(input, components);
	});
