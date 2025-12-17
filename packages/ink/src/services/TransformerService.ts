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

import { Effect, Context, Layer } from 'effect';
import type { EffuseChild } from '@effuse/core';
import {
	transformDocument,
	type ComponentMap,
} from '../renderer/transformer.js';
import { TransformError } from '../types/errors.js';
import type { DocumentNode } from '../types/ast.js';

export interface TransformerServiceInterface {
	readonly transform: (
		doc: DocumentNode,
		components: ComponentMap
	) => Effect.Effect<EffuseChild[], TransformError>;
}

export class TransformerService extends Context.Tag('ink/TransformerService')<
	TransformerService,
	TransformerServiceInterface
>() {}

const make: TransformerServiceInterface = {
	transform: (doc: DocumentNode, components: ComponentMap) =>
		Effect.try({
			try: () => transformDocument(doc, components),
			catch: (error) =>
				new TransformError({
					message: `Transformation failed: ${String(error)}`,
					nodeType: 'document',
					cause: error,
				}),
		}),
};

export const TransformerServiceLive = Layer.succeed(TransformerService, make);

export const transformMarkdown = (
	doc: DocumentNode,
	components: ComponentMap = {}
): Effect.Effect<EffuseChild[], TransformError, TransformerService> =>
	Effect.gen(function* () {
		const transformer = yield* TransformerService;
		return yield* transformer.transform(doc, components);
	});
