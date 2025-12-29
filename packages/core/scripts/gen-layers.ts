import { Effect, Context, Layer, Console, Data, pipe } from 'effect';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

interface LayerInfo {
	readonly name: string;
	readonly propsType: string | null;
	readonly providesType: string | null;
	readonly sourceFile: string;
}

class LayerParseError extends Data.TaggedError('LayerParseError')<{
	readonly file: string;
	readonly message: string;
}> {}

class FileSystemError extends Data.TaggedError('FileSystemError')<{
	readonly path: string;
	readonly message: string;
}> {}

class FileScanner extends Context.Tag('FileScanner')<
	FileScanner,
	{
		readonly scanDirectory: (
			dir: string
		) => Effect.Effect<readonly string[], FileSystemError>;
	}
>() {}

const FileScannerLive = Layer.succeed(FileScanner, {
	scanDirectory: (dir: string) =>
		Effect.try({
			try: () => scanLayerFilesSync(dir),
			catch: (error) =>
				new FileSystemError({
					path: dir,
					message: error instanceof Error ? error.message : String(error),
				}),
		}),
});

class LayerParser extends Context.Tag('LayerParser')<
	LayerParser,
	{
		readonly parseFile: (
			filePath: string
		) => Effect.Effect<LayerInfo | null, LayerParseError>;
	}
>() {}

const LayerParserLive = Layer.succeed(LayerParser, {
	parseFile: (filePath: string) =>
		Effect.try({
			try: () => parseLayerFileSync(filePath),
			catch: (error) =>
				new LayerParseError({
					file: filePath,
					message: error instanceof Error ? error.message : String(error),
				}),
		}),
});

class RegistryGenerator extends Context.Tag('RegistryGenerator')<
	RegistryGenerator,
	{
		readonly generate: (layers: readonly LayerInfo[]) => string;
		readonly writeFile: (
			outputPath: string,
			content: string
		) => Effect.Effect<void, FileSystemError>;
	}
>() {}

const RegistryGeneratorLive = Layer.succeed(RegistryGenerator, {
	generate: (layers: readonly LayerInfo[]) => generateRegistryContent(layers),
	writeFile: (outputPath: string, content: string) =>
		Effect.try({
			try: () => {
				fs.writeFileSync(outputPath, content, 'utf-8');
			},
			catch: (error) =>
				new FileSystemError({
					path: outputPath,
					message: error instanceof Error ? error.message : String(error),
				}),
		}),
});

const GeneratorServicesLive = Layer.mergeAll(
	FileScannerLive,
	LayerParserLive,
	RegistryGeneratorLive
);

const LAYER_FILE_PATTERN = /Layer\.(ts|tsx)$/;

function scanLayerFilesSync(dir: string): readonly string[] {
	const files: string[] = [];

	if (!fs.existsSync(dir)) {
		return files;
	}

	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isFile() && LAYER_FILE_PATTERN.test(entry.name)) {
			files.push(fullPath);
		} else if (entry.isDirectory()) {
			files.push(...scanLayerFilesSync(fullPath));
		}
	}

	return files;
}

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
						providesType = extractProvidesType(prop.initializer, sourceFile);
					}
				}

				if (name) {
					layerInfo = { name, propsType, providesType, sourceFile: filePath };
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
): string {
	const provides: string[] = [];

	for (const prop of node.properties) {
		if (
			ts.isPropertyAssignment(prop) ||
			ts.isShorthandPropertyAssignment(prop)
		) {
			const propName = prop.name.getText(sourceFile);
			provides.push(`${propName}: unknown`);
		}
	}

	return provides.length > 0 ? `{ ${provides.join('; ')} }` : '{}';
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

function generateRegistryContent(layers: readonly LayerInfo[]): string {
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

	return `/**
 * Auto-generated by effuse-gen-layers
 * DO NOT EDIT MANUALLY
 *
 * Regenerate: pnpm --filter @effuse/core gen-layers -- <layers-dir> <output>
 */

import type { Signal } from '@effuse/core';

declare module '@effuse/core' {
\tinterface EffuseLayerRegistry {
${layerEntries}
\t}
}

export {};
`;
}

const program = Effect.gen(function* () {
	const args = process.argv.slice(2);
	const layersDir = path.resolve(args[0] || './src/layers');
	const outputFile = path.resolve(
		args[1] || './src/layers/registry.generated.d.ts'
	);

	yield* Console.log(`Scanning layers in: ${layersDir}`);

	const scanner = yield* FileScanner;
	const parser = yield* LayerParser;
	const generator = yield* RegistryGenerator;

	const layerFiles = yield* scanner.scanDirectory(layersDir);
	yield* Console.log(`Found ${layerFiles.length} layer files`);

	const layers: LayerInfo[] = [];
	for (const file of layerFiles) {
		const info = yield* parser.parseFile(file);
		if (info) {
			yield* Console.log(`  ${info.name} (${path.basename(file)})`);
			layers.push(info);
		}
	}

	if (layers.length === 0) {
		yield* Console.log('No layers found');
		return;
	}

	const content = generator.generate(layers);
	yield* generator.writeFile(outputFile, content);

	yield* Console.log(`\nGenerated: ${outputFile}`);
	yield* Console.log(`   ${layers.length} layers registered`);
});

const runnable = pipe(program, Effect.provide(GeneratorServicesLive));

Effect.runPromise(runnable).catch((error) => {
	console.error('Generation failed:', error);
	process.exit(1);
});
