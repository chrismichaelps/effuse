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

import { Effect, Console, pipe } from 'effect';
import * as path from 'path';

import { ConfigService } from './config.js';
import { FileScanner, LayerParser, RegistryWriter } from './services.js';
import { NoLayersFoundError } from './errors.js';
import type { LayerInfo } from './types.js';

const program = Effect.gen(function* () {
	const config = yield* ConfigService;
	const { layersDir, outputFile, filePattern, verbose } = config.withCliArgs(
		process.argv.slice(2)
	);

	yield* Console.log(`Scanning layers in: ${layersDir}`);

	const scanner = yield* FileScanner;
	const parser = yield* LayerParser;
	const writer = yield* RegistryWriter;

	const layerFiles = yield* scanner.scanDirectory(layersDir, filePattern);

	if (verbose) {
		yield* Console.log(`   Pattern: ${filePattern.toString()}`);
	}
	yield* Console.log(`Found ${layerFiles.length} layer files`);

	const layers: LayerInfo[] = [];
	for (const file of layerFiles) {
		const info = yield* parser.parseFile(file);
		if (info) {
			yield* Console.log(`  ${info.name} (${path.basename(file)})`);
			if (verbose && info.propsType) {
				yield* Console.log(`      props: ${info.propsType}`);
			}
			layers.push(info);
		}
	}

	if (layers.length === 0) {
		return yield* Effect.fail(new NoLayersFoundError({ directory: layersDir }));
	}

	const content = writer.generate(layers);
	yield* writer.writeFile(outputFile, content);

	yield* Console.log(`\nGenerated: ${outputFile}`);
	yield* Console.log(`  ${layers.length} layers registered`);
});

const runnable = pipe(
	program,
	Effect.provide(ConfigService.Default),
	Effect.provide(FileScanner.Default),
	Effect.provide(LayerParser.Default),
	Effect.provide(RegistryWriter.Default),
	Effect.catchAll((error) =>
		Console.error(`Error: ${error._tag}: ${error.message}`)
	)
);

Effect.runPromise(runnable).catch((error) => {
	console.error('Unexpected error:', error);
	process.exit(1);
});
