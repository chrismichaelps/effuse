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

import { Config, Effect } from 'effect';
import * as path from 'path';

export interface GeneratorConfig {
	readonly layersDir: string;
	readonly outputFile: string;
	readonly filePattern: RegExp;
	readonly verbose: boolean;
}

export const DEFAULTS = {
	LAYERS_DIR: './src/layers',
	OUTPUT_FILE: './src/layers/registry.generated.d.ts',
	FILE_PATTERN: /Layer\.(ts|tsx)$/,
	VERBOSE: false,
} as const;

export class ConfigService extends Effect.Service<ConfigService>()(
	'ConfigService',
	{
		effect: Effect.gen(function* () {
			const layersDir = yield* Config.string('EFFUSE_LAYERS_DIR').pipe(
				Config.withDefault(DEFAULTS.LAYERS_DIR)
			);
			const outputFile = yield* Config.string('EFFUSE_OUTPUT_FILE').pipe(
				Config.withDefault(DEFAULTS.OUTPUT_FILE)
			);
			const verbose = yield* Config.boolean('EFFUSE_VERBOSE').pipe(
				Config.withDefault(DEFAULTS.VERBOSE)
			);

			return {
				get: (): GeneratorConfig => ({
					layersDir: path.resolve(layersDir),
					outputFile: path.resolve(outputFile),
					filePattern: DEFAULTS.FILE_PATTERN,
					verbose,
				}),
				withCliArgs: (args: readonly string[]): GeneratorConfig => {
					const dir = args[0] || layersDir;
					const out = args[1] || outputFile;
					return {
						layersDir: path.resolve(dir),
						outputFile: path.resolve(out),
						filePattern: DEFAULTS.FILE_PATTERN,
						verbose: args.includes('--verbose') || args.includes('-v'),
					};
				},
			};
		}),
	}
) {}
