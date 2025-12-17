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

export const DOMBindingTypeSchema = Schema.Literal(
	'text',
	'attr',
	'prop',
	'style'
);
export type DOMBindingType = Schema.Schema.Type<typeof DOMBindingTypeSchema>;

export const DOMBindingSchema = Schema.Struct({
	type: DOMBindingTypeSchema,
	key: Schema.String,
	value: Schema.Unknown,
	isReactive: Schema.Boolean,
});
export type DOMBinding = Schema.Schema.Type<typeof DOMBindingSchema>;

export const EventBindingSchema = Schema.Struct({
	eventName: Schema.String,
	handler: Schema.Unknown,
	options: Schema.optional(
		Schema.Struct({
			capture: Schema.optional(Schema.Boolean),
			passive: Schema.optional(Schema.Boolean),
			once: Schema.optional(Schema.Boolean),
		})
	),
});
export type EventBinding = Schema.Schema.Type<typeof EventBindingSchema>;

export const FormControlTypeSchema = Schema.Literal(
	'text',
	'checkbox',
	'radio',
	'select',
	'textarea'
);
export type FormControlType = Schema.Schema.Type<typeof FormControlTypeSchema>;

export const FormControlBindingSchema = Schema.Struct({
	controlType: FormControlTypeSchema,
	signal: Schema.Unknown,
	preserveCursor: Schema.Boolean,
});
export type FormControlBinding = Schema.Schema.Type<
	typeof FormControlBindingSchema
>;

export const ReconcileOpTypeSchema = Schema.Literal(
	'insert',
	'move',
	'remove',
	'update'
);
export type ReconcileOpType = Schema.Schema.Type<typeof ReconcileOpTypeSchema>;

export const ReconcileOpSchema = Schema.Struct({
	type: ReconcileOpTypeSchema,
	key: Schema.Union(Schema.String, Schema.Number),
	index: Schema.optional(Schema.Number),
	node: Schema.optional(Schema.Unknown),
});
export type ReconcileOp = Schema.Schema.Type<typeof ReconcileOpSchema>;

export const MountResultSchema = Schema.Struct({
	nodes: Schema.Array(Schema.Unknown),
	cleanup: Schema.Unknown,
});
export type MountResult = Schema.Schema.Type<typeof MountResultSchema>;
