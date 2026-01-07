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

import { Schema } from 'effect';
import {
	DefaultSignalAccessors,
	DefaultEventHandlerPrefixes,
	DefaultExtensions,
	DefaultExcludePatterns,
} from '../constants/index.js';

export const CompilerConfigSchema = Schema.Struct({
	autoUnwrap: Schema.optionalWith(Schema.Boolean, { default: () => true }),

	autoUnwrapProps: Schema.optionalWith(Schema.Boolean, { default: () => true }),

	extensions: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [...DefaultExtensions],
	}),

	exclude: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [...DefaultExcludePatterns],
	}),

	sourceMaps: Schema.optionalWith(Schema.Boolean, { default: () => true }),

	debug: Schema.optionalWith(Schema.Boolean, { default: () => false }),

	signalAccessors: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [...DefaultSignalAccessors],
	}),

	eventHandlerPrefixes: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [...DefaultEventHandlerPrefixes],
	}),

	enableCache: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});

export type CompilerConfig = Schema.Schema.Type<typeof CompilerConfigSchema>;

export const defaultConfig: CompilerConfig = Schema.decodeUnknownSync(
	CompilerConfigSchema
)({});

export const mergeConfig = (
	userConfig: Partial<CompilerConfig>
): CompilerConfig => {
	return Schema.decodeUnknownSync(CompilerConfigSchema)(userConfig);
};
