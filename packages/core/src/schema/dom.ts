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

export const ElementPropsSchema = Schema.Union(
	Schema.Struct({
		key: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
		class: Schema.optional(
			Schema.Union(
				Schema.String,
				Schema.Record({ key: Schema.String, value: Schema.Boolean }),
				Schema.Array(
					Schema.Union(
						Schema.String,
						Schema.Record({ key: Schema.String, value: Schema.Boolean })
					)
				)
			)
		),
		style: Schema.optional(
			Schema.Union(
				Schema.String,
				Schema.Record({
					key: Schema.String,
					value: Schema.Union(Schema.String, Schema.Number),
				})
			)
		),
		ref: Schema.optional(Schema.Unknown),
	}).pipe(
		Schema.extend(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
	),
	Schema.Null,
	Schema.Undefined
);

export type ElementProps = Schema.Schema.Type<typeof ElementPropsSchema>;

export const BaseNodeSchema = Schema.Struct({
	key: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
});
