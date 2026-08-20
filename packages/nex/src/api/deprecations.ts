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

import {
	findDeprecations as inspect,
	type DeprecationNotice,
	type DeprecationOptions,
} from '../analysis/index.js';
import type { Catalog } from '../catalog/index.js';
import { parse } from './parse.js';
import type { RequestInput } from './validate-request.js';

/**
 * Find everything a request leans on that the catalog has deprecated.
 *
 * A request that validates cleanly can still be asking for things on their way
 * out; this is what tells a client to move, and a server what its clients
 * still depend on.
 *
 * @throws {NexSyntaxError} when source text does not parse.
 */
export const findDeprecations = (
	input: RequestInput,
	catalog: Catalog,
	options: DeprecationOptions = {}
): readonly DeprecationNotice[] =>
	inspect(typeof input === 'string' ? parse(input) : input, catalog, options);
