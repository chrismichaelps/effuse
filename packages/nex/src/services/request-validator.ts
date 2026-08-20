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

import { Context, type Effect } from 'effect';
import type { Catalog } from '../catalog/index.js';
import type { NexValidationError } from '../errors/index.js';
import type { DocumentNode } from '../language/ast/index.js';
import type { ValidationOptions } from '../validation/index.js';

/** Checks a request against a catalog, collecting every problem it finds. */
export class RequestValidatorService extends Context.Tag(
	'@effuse/nex/RequestValidatorService'
)<
	RequestValidatorService,
	{
		readonly validate: (
			document: DocumentNode,
			catalog: Catalog,
			options: ValidationOptions
		) => Effect.Effect<readonly NexValidationError[]>;
	}
>() {}
