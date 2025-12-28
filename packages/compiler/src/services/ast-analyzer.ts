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

import { Context, Layer } from 'effect';
import type * as t from '@babel/types';
import {
	containsSignalAccess,
	isEventHandler,
	isAlreadyWrapped,
	isAssignment,
	analyzeNode,
	createAccessorSet,
	createPrefixSet,
	type NodeAnalysis,
} from '../utils/index.js';

export type { NodeAnalysis };

export interface AstAnalyzerService {
	readonly containsSignalAccess: (
		node: t.Node,
		accessorSet: Set<string>
	) => boolean;

	readonly isEventHandler: (name: string, prefixSet: Set<string>) => boolean;

	readonly isAlreadyWrapped: (node: t.Node) => boolean;

	readonly isAssignment: (node: t.Node) => boolean;

	readonly analyzeNode: (
		node: t.Node,
		accessorSet: Set<string>,
		prefixSet: Set<string>,
		attrName?: string
	) => NodeAnalysis;

	readonly createAccessorSet: (accessors: readonly string[]) => Set<string>;
	readonly createPrefixSet: (prefixes: readonly string[]) => Set<string>;
}

export class AstAnalyzer extends Context.Tag('effuse/compiler/AstAnalyzer')<
	AstAnalyzer,
	AstAnalyzerService
>() {}

export const AstAnalyzerLive = Layer.succeed(AstAnalyzer, {
	containsSignalAccess,
	isEventHandler,
	isAlreadyWrapped,
	isAssignment,
	analyzeNode,
	createAccessorSet,
	createPrefixSet,
});
