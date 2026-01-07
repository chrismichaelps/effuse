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

import { Effect, Layer, pipe } from 'effect';
import { parse, type ParserOptions } from '@babel/parser';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import type { CompilerConfig } from '../config/index.js';
import { ParseError, TransformError, GenerateError } from '../errors/index.js';
import {
	AstAnalyzer,
	AstAnalyzerLive,
	SourceCache,
	SourceCacheLive,
	createContentHash,
} from '../services/index.js';
import { NodeTypes } from '../constants/index.js';
import {
	wrapInArrowFunction,
	getAttributeName,
	traverse,
	generate,
} from '../utils/index.js';

export interface TransformResult {
	readonly code: string;
	readonly map: object | null;
	readonly transformed: boolean;
	readonly stats: TransformStats;
	readonly cached: boolean;
}

export interface TransformStats {
	readonly expressionsWrapped: number;
	readonly propsWrapped: number;
	readonly skipped: number;
}

const parseSource = (
	code: string,
	filename: string
): Effect.Effect<t.File, ParseError> =>
	Effect.try({
		try: () => {
			const options: ParserOptions = {
				sourceType: 'module',
				plugins: [
					'jsx',
					'typescript',
					['decorators', { decoratorsBeforeExport: true }],
				],
				sourceFilename: filename,
			};
			return parse(code, options);
		},
		catch: (error) =>
			ParseError.create({
				file: filename,
				message: error instanceof Error ? error.message : String(error),
				line: (error as { loc?: { line: number } }).loc?.line,
				column: (error as { loc?: { column: number } }).loc?.column,
			}),
	});

const generateCode = (
	ast: t.File,
	filename: string,
	sourceMaps: boolean
): Effect.Effect<{ code: string; map: object | null }, GenerateError> =>
	Effect.try({
		try: () => {
			const result = generate(
				ast,
				{ sourceMaps, sourceFileName: filename, retainLines: true },
				undefined
			);
			return { code: result.code, map: result.map ?? null };
		},
		catch: (error) =>
			GenerateError.create({
				file: filename,
				message: error instanceof Error ? error.message : String(error),
			}),
	});

const transformAST = (
	ast: t.File,
	config: CompilerConfig,
	filename: string
): Effect.Effect<
	{ ast: t.File; stats: TransformStats },
	TransformError,
	AstAnalyzer
> =>
	Effect.gen(function* () {
		const analyzer = yield* AstAnalyzer;

		const stats = { expressionsWrapped: 0, propsWrapped: 0, skipped: 0 };
		const accessorSet = analyzer.createAccessorSet(config.signalAccessors);
		const prefixSet = analyzer.createPrefixSet(config.eventHandlerPrefixes);

		try {
			traverse(ast, {
				JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
					const expr = path.node.expression;
					if (expr.type === NodeTypes.JSX_EMPTY_EXPRESSION) return;

					const parent = path.parent;
					let attrName: string | undefined;

					if (parent.type === NodeTypes.JSX_ATTRIBUTE) {
						attrName = getAttributeName(parent as t.JSXAttribute);
						if (!config.autoUnwrapProps) {
							stats.skipped++;
							return;
						}
					} else if (!config.autoUnwrap) {
						stats.skipped++;
						return;
					}

					const analysis = analyzer.analyzeNode(
						expr,
						accessorSet,
						prefixSet,
						attrName
					);

					if (!analysis.shouldWrap) {
						stats.skipped++;
						return;
					}

					path.node.expression = wrapInArrowFunction(expr);

					if (parent.type === NodeTypes.JSX_ATTRIBUTE) {
						stats.propsWrapped++;
					} else {
						stats.expressionsWrapped++;
					}
				},
			});

			return { ast, stats };
		} catch (error) {
			return yield* Effect.fail(
				TransformError.create({
					file: filename,
					message: error instanceof Error ? error.message : String(error),
				})
			);
		}
	});

export const transform = (
	code: string,
	filename: string,
	config: CompilerConfig
): Effect.Effect<
	TransformResult,
	ParseError | TransformError | GenerateError,
	AstAnalyzer | SourceCache
> =>
	Effect.gen(function* () {
		const cache = yield* SourceCache;

		if (config.enableCache) {
			const contentHash = createContentHash(code);
			const cached = yield* cache.get<TransformResult>(filename, contentHash);

			if (cached) {
				return { ...cached, cached: true };
			}

			const result = yield* pipe(
				parseSource(code, filename),
				Effect.flatMap((ast) => transformAST(ast, config, filename)),
				Effect.flatMap(({ ast, stats }) =>
					pipe(
						generateCode(ast, filename, config.sourceMaps),
						Effect.map(({ code, map }) => ({
							code,
							map,
							transformed: stats.expressionsWrapped + stats.propsWrapped > 0,
							stats,
							cached: false,
						}))
					)
				)
			);

			yield* cache.set(filename, contentHash, result);
			return result;
		}

		return yield* pipe(
			parseSource(code, filename),
			Effect.flatMap((ast) => transformAST(ast, config, filename)),
			Effect.flatMap(({ ast, stats }) =>
				pipe(
					generateCode(ast, filename, config.sourceMaps),
					Effect.map(({ code, map }) => ({
						code,
						map,
						transformed: stats.expressionsWrapped + stats.propsWrapped > 0,
						stats,
						cached: false,
					}))
				)
			)
		);
	});

export const TransformerLive = Layer.merge(AstAnalyzerLive, SourceCacheLive);

export const transformSync = (
	code: string,
	filename: string,
	config: CompilerConfig
): TransformResult => {
	return Effect.runSync(
		pipe(transform(code, filename, config), Effect.provide(TransformerLive))
	);
};

export const transformAsync = (
	code: string,
	filename: string,
	config: CompilerConfig
): Promise<TransformResult> => {
	return Effect.runPromise(
		pipe(transform(code, filename, config), Effect.provide(TransformerLive))
	);
};
