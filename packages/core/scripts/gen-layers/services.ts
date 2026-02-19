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

import { Effect, Layer } from 'effect';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { FileSystemError, LayerParseError } from './errors.js';
import type { LayerInfo, ServiceEntry } from './types.js';
import { DEFAULTS } from './config.js';

export class FileScanner extends Effect.Service<FileScanner>()('FileScanner', {
	effect: Effect.succeed({
		scanDirectory: (
			dir: string,
			pattern: RegExp = DEFAULTS.FILE_PATTERN
		): Effect.Effect<readonly string[], FileSystemError> =>
			Effect.try({
				try: () => scanDirectorySync(dir, pattern),
				catch: (error) =>
					new FileSystemError({
						path: dir,
						operation: 'scan',
						cause: error instanceof Error ? error.message : String(error),
					}),
			}),
	}),
}) {}

function scanDirectorySync(dir: string, pattern: RegExp): readonly string[] {
	const files: string[] = [];

	if (!fs.existsSync(dir)) {
		return files;
	}

	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isFile() && pattern.test(entry.name)) {
			files.push(fullPath);
		} else if (entry.isDirectory()) {
			files.push(...scanDirectorySync(fullPath, pattern));
		}
	}

	return files;
}

export class LayerParser extends Effect.Service<LayerParser>()('LayerParser', {
	effect: Effect.succeed({
		parseFile: (
			filePath: string
		): Effect.Effect<LayerInfo | null, LayerParseError> =>
			Effect.try({
				try: () => parseLayerFileSync(filePath),
				catch: (error) =>
					new LayerParseError({
						file: filePath,
						cause: error instanceof Error ? error.message : String(error),
					}),
			}),

		parseAll: (
			files: readonly string[]
		): Effect.Effect<readonly LayerInfo[], LayerParseError> =>
			Effect.gen(function* () {
				const layers: LayerInfo[] = [];
				for (const file of files) {
					const result = yield* Effect.try({
						try: () => parseLayerFileSync(file),
						catch: (error) =>
							new LayerParseError({
								file,
								cause: error instanceof Error ? error.message : String(error),
							}),
					});
					if (result) {
						layers.push(result);
					}
				}
				return layers;
			}),
	}),
}) {}

function parseLayerFileSync(filePath: string): LayerInfo | null {
	const content = fs.readFileSync(filePath, 'utf-8');
	const sourceFile = ts.createSourceFile(
		filePath,
		content,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX
	);

	return extractLayerInfo(sourceFile, filePath);
}

function extractLayerInfo(
	sourceFile: ts.SourceFile,
	filePath: string
): LayerInfo | null {
	let layerInfo: LayerInfo | null = null;

	const visit = (node: ts.Node) => {
		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === 'defineLayer'
		) {
			const arg = node.arguments[0];
			if (arg && ts.isObjectLiteralExpression(arg)) {
				let name: string | null = null;
				let propsType: string | null = null;
				let providesType: string | null = null;
				let serviceEntries: readonly ServiceEntry[] = [];
				let componentNames: readonly string[] = [];

				for (const prop of arg.properties) {
					if (!ts.isPropertyAssignment(prop)) continue;
					const propName = prop.name.getText(sourceFile);

					if (propName === 'name' && ts.isStringLiteral(prop.initializer)) {
						name = prop.initializer.text;
					}
					if (
						propName === 'props' &&
						ts.isObjectLiteralExpression(prop.initializer)
					) {
						propsType = extractPropsType(prop.initializer, sourceFile);
					}
					if (
						propName === 'provides' &&
						ts.isObjectLiteralExpression(prop.initializer)
					) {
						const result = extractProvidesType(prop.initializer, sourceFile);
						providesType = result.type;
						serviceEntries = result.entries;
					}
					if (
						propName === 'components' &&
						ts.isObjectLiteralExpression(prop.initializer)
					) {
						componentNames = prop.initializer.properties
							.filter(ts.isPropertyAssignment)
							.map((p) => p.name.getText(sourceFile))
							.concat(
								prop.initializer.properties
									.filter(ts.isShorthandPropertyAssignment)
									.map((p) => p.name.getText(sourceFile))
							);
					}
				}

				if (name) {
					layerInfo = {
						name,
						propsType,
						providesType,
						serviceEntries,
						componentNames,
						sourceFile: filePath,
					};
				}
			}
		}
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return layerInfo;
}

function extractPropsType(
	node: ts.ObjectLiteralExpression,
	sourceFile: ts.SourceFile
): string {
	const props: string[] = [];

	for (const prop of node.properties) {
		if (
			ts.isPropertyAssignment(prop) ||
			ts.isShorthandPropertyAssignment(prop)
		) {
			const propName = prop.name.getText(sourceFile);
			if (ts.isPropertyAssignment(prop)) {
				const init = prop.initializer;
				if (ts.isCallExpression(init)) {
					const funcName = init.expression.getText(sourceFile);
					if (funcName === 'signal') {
						const arg = init.arguments[0];
						const inferredType = arg
							? inferTypeFromNode(arg, sourceFile)
							: 'unknown';
						props.push(`${propName}: Signal<${inferredType}>`);
					}
				}
			}
		}
	}

	return props.length > 0 ? `{ ${props.join('; ')} }` : '{}';
}

function extractProvidesType(
	node: ts.ObjectLiteralExpression,
	sourceFile: ts.SourceFile
): { type: string; entries: ServiceEntry[] } {
	const provides: string[] = [];
	const entries: ServiceEntry[] = [];

	for (const prop of node.properties) {
		if (
			ts.isPropertyAssignment(prop) ||
			ts.isShorthandPropertyAssignment(prop)
		) {
			const propName = prop.name.getText(sourceFile);

			if (ts.isPropertyAssignment(prop)) {
				const returnType = inferFactoryReturnType(prop.initializer, sourceFile);
				provides.push(`${propName}: ${returnType}`);
				entries.push({ key: propName, type: returnType });
			} else {
				provides.push(`${propName}: unknown`);
				entries.push({ key: propName, type: 'unknown' });
			}
		}
	}

	const type = provides.length > 0 ? `{ ${provides.join('; ')} }` : '{}';
	return { type, entries };
}

function inferFactoryReturnType(
	node: ts.Node,
	sourceFile: ts.SourceFile
): string {
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		const body = node.body;

		if (ts.isBlock(body)) {
			const returnStatements = findReturnStatements(body);
			if (returnStatements.length === 1 && returnStatements[0]?.expression) {
				return inferExpressionType(returnStatements[0].expression, sourceFile);
			}
			return 'unknown';
		}

		return inferExpressionType(body, sourceFile);
	}

	return 'unknown';
}

function findReturnStatements(block: ts.Block): ts.ReturnStatement[] {
	const returns: ts.ReturnStatement[] = [];
	const visit = (node: ts.Node) => {
		if (ts.isReturnStatement(node)) {
			returns.push(node);
		}
		if (!ts.isFunctionDeclaration(node) && !ts.isArrowFunction(node)) {
			ts.forEachChild(node, visit);
		}
	};
	ts.forEachChild(block, visit);
	return returns;
}

function inferExpressionType(
	expr: ts.Expression,
	sourceFile: ts.SourceFile
): string {
	if (ts.isParenthesizedExpression(expr)) {
		return inferExpressionType(expr.expression, sourceFile);
	}

	if (ts.isCallExpression(expr)) {
		const funcText = expr.expression.getText(sourceFile);
		return `ReturnType<typeof ${funcText}>`;
	}

	if (ts.isNewExpression(expr)) {
		const className = expr.expression.getText(sourceFile);
		return className;
	}

	if (ts.isObjectLiteralExpression(expr)) {
		const props: string[] = [];
		for (const p of expr.properties) {
			if (ts.isPropertyAssignment(p)) {
				const key = p.name.getText(sourceFile);
				const valueType = inferTypeFromNode(p.initializer, sourceFile);
				props.push(`${key}: ${valueType}`);
			}
		}
		return props.length > 0 ? `{ ${props.join('; ')} }` : 'object';
	}

	return inferTypeFromNode(expr, sourceFile);
}

function inferTypeFromNode(node: ts.Node, _sourceFile: ts.SourceFile): string {
	if (ts.isStringLiteral(node)) return 'string';
	if (ts.isNumericLiteral(node)) return 'number';
	if (
		node.kind === ts.SyntaxKind.TrueKeyword ||
		node.kind === ts.SyntaxKind.FalseKeyword
	) {
		return 'boolean';
	}
	if (ts.isArrayLiteralExpression(node)) return 'unknown[]';
	if (ts.isObjectLiteralExpression(node)) return 'object';
	return 'unknown';
}

export class RegistryWriter extends Effect.Service<RegistryWriter>()(
	'RegistryWriter',
	{
		effect: Effect.succeed({
			generate: (layers: readonly LayerInfo[]): string => {
				const layerEntries = layers
					.map((layer) => {
						const parts: string[] = [];
						if (layer.propsType && layer.propsType !== '{}') {
							parts.push(`props: ${layer.propsType}`);
						}
						if (layer.providesType && layer.providesType !== '{}') {
							parts.push(`provides: ${layer.providesType}`);
						}
						const body = parts.length > 0 ? parts.join(';\n\t\t\t') : '';
						return `\t\t${layer.name}: {\n\t\t\t${body}\n\t\t};`;
					})
					.join('\n');

				const allServices = layers.flatMap((l) => l.serviceEntries);
				const serviceEntries = allServices
					.map((s) => `\t\t${s.key}: ${s.type};`)
					.join('\n');

				const serviceBlock =
					allServices.length > 0
						? `\n\tinterface EffuseServiceRegistry {\n${serviceEntries}\n\t}\n`
						: '';

				const allComponents = layers.flatMap((l) => l.componentNames);
				const componentEntries = allComponents
					.map((name) => `\t\t${name}: Component;`)
					.join('\n');

				const componentBlock =
					allComponents.length > 0
						? `\n\tinterface EffuseComponentRegistry {\n${componentEntries}\n\t}\n`
						: '';

				return `/**
 * Auto-generated by effuse-gen-layers
 * DO NOT EDIT MANUALLY
 *
 * Regenerate: pnpm gen-layers
 */

import type { Signal, Component } from '@effuse/core';

declare module '@effuse/core' {
\tinterface EffuseLayerRegistry {
${layerEntries}
\t}
${serviceBlock}${componentBlock}}

export {};
`;
			},

			writeFile: (
				outputPath: string,
				content: string
			): Effect.Effect<void, FileSystemError> =>
				Effect.try({
					try: () => {
						const dir = path.dirname(outputPath);
						if (!fs.existsSync(dir)) {
							fs.mkdirSync(dir, { recursive: true });
						}
						fs.writeFileSync(outputPath, content, 'utf-8');
					},
					catch: (error) =>
						new FileSystemError({
							path: outputPath,
							operation: 'write',
							cause: error instanceof Error ? error.message : String(error),
						}),
				}),
		}),
	}
) {}

export const GeneratorServicesLive = Layer.mergeAll(
	FileScanner.Default,
	LayerParser.Default,
	RegistryWriter.Default
);
