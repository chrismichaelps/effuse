/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { parse, type ParserOptions } from '@babel/parser';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import type { CompilerConfig } from '../config/index.js';
import { ParseError, TransformError, GenerateError } from '../errors/index.js';
import {
	containsSignalAccess,
	isEventHandler,
	createAccessorSet,
	createPrefixSet,
	SourceCache,
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

const parseSource = (code: string, filename: string): t.File => {
	try {
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
	} catch (error) {
		throw ParseError.create({
			file: filename,
			message: error instanceof Error ? error.message : String(error),
			line: (error as { loc?: { line: number } }).loc?.line,
			column: (error as { loc?: { column: number } }).loc?.column,
		});
	}
};

const generateCode = (
	ast: t.File,
	filename: string,
	sourceMaps: boolean
): { code: string; map: object | null } => {
	try {
		const result = generate(
			ast,
			{ sourceMaps, sourceFileName: filename, retainLines: true },
			undefined
		);
		return { code: result.code, map: result.map ?? null };
	} catch (error) {
		throw GenerateError.create({
			file: filename,
			message: error instanceof Error ? error.message : String(error),
		});
	}
};

const transformAST = (
	ast: t.File,
	config: CompilerConfig,
	filename: string
): { ast: t.File; stats: TransformStats } => {
	const stats = { expressionsWrapped: 0, propsWrapped: 0, skipped: 0 };
	const accessorSet = createAccessorSet(config.signalAccessors);
	const prefixSet = createPrefixSet(config.eventHandlerPrefixes);

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

				const hasSignal = containsSignalAccess(expr, accessorSet);
				const isEventHandlerMatch = attrName
					? isEventHandler(attrName, prefixSet)
					: false;

				const isWrapped =
					expr.type === NodeTypes.ARROW_FUNCTION_EXPRESSION ||
					expr.type === NodeTypes.FUNCTION_EXPRESSION;
				const isAssign =
					expr.type === NodeTypes.ASSIGNMENT_EXPRESSION ||
					expr.type === NodeTypes.UPDATE_EXPRESSION;

				const shouldWrap = hasSignal && !isEventHandlerMatch && !isWrapped && !isAssign;

				if (!shouldWrap) {
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
		throw TransformError.create({
			file: filename,
			message: error instanceof Error ? error.message : String(error),
		});
	}
};

export const transformSync = (
	code: string,
	filename: string,
	config: CompilerConfig,
	cache?: SourceCache
): TransformResult => {
	const sourceCache = cache ?? new SourceCache();

	if (config.enableCache) {
		const configHash = createContentHash(
			JSON.stringify([
				config.autoUnwrap,
				config.autoUnwrapProps,
				config.signalAccessors,
				config.eventHandlerPrefixes,
				config.sourceMaps,
			])
		);
		const contentHash = createContentHash(`${code}:${configHash}`);
		const cached = sourceCache.get<TransformResult>(filename, contentHash);

		if (cached) {
			return { ...cached, cached: true };
		}

		const ast = parseSource(code, filename);
		const { ast: transformedAst, stats } = transformAST(ast, config, filename);
		const { code: generatedCode, map } = generateCode(
			transformedAst,
			filename,
			config.sourceMaps
		);
		const result: TransformResult = {
			code: generatedCode,
			map,
			transformed: stats.expressionsWrapped + stats.propsWrapped > 0,
			stats,
			cached: false,
		};

		sourceCache.set(filename, contentHash, result);
		return result;
	}

	const ast = parseSource(code, filename);
	const { ast: transformedAst, stats } = transformAST(ast, config, filename);
	const { code: generatedCode, map } = generateCode(
		transformedAst,
		filename,
		config.sourceMaps
	);
	return {
		code: generatedCode,
		map,
		transformed: stats.expressionsWrapped + stats.propsWrapped > 0,
		stats,
		cached: false,
	};
};

export const transformAsync = (
	code: string,
	filename: string,
	config: CompilerConfig,
	cache?: SourceCache
): Promise<TransformResult> => {
	return Promise.resolve(transformSync(code, filename, config, cache));
};
