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
import { EFFUSE_NODE, NodeType } from '../constants.js';
import { ElementPropsSchema } from './dom.js';

const BaseNodeSchema = Schema.Struct({
	[EFFUSE_NODE]: Schema.Literal(true),
	key: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
});

export const EffuseChildSchema: Schema.Schema<unknown> = Schema.suspend(() =>
	Schema.Union(
		EffuseNodeSchema,
		Schema.String,
		Schema.Number,
		Schema.Boolean,
		Schema.Null,
		Schema.Undefined,
		Schema.Array(EffuseChildSchema),
		Schema.Object
	)
) as unknown as Schema.Schema<unknown>;

export const PortalFnSchema = Schema.Unknown;
export const PortalsSchema = Schema.Record({
	key: Schema.String,
	value: PortalFnSchema,
});

export const ElementNodeSchema = BaseNodeSchema.pipe(
	Schema.extend(
		Schema.Struct({
			type: Schema.Literal(NodeType.ELEMENT),
			tag: Schema.String,
			props: Schema.Union(ElementPropsSchema, Schema.Null),
			children: Schema.Array(EffuseChildSchema),
		})
	)
);

export const TextNodeSchema = BaseNodeSchema.pipe(
	Schema.extend(
		Schema.Struct({
			type: Schema.Literal(NodeType.TEXT),
			text: Schema.String,
		})
	)
);

export const FragmentNodeSchema = BaseNodeSchema.pipe(
	Schema.extend(
		Schema.Struct({
			type: Schema.Literal(NodeType.FRAGMENT),
			children: Schema.Array(EffuseChildSchema),
		})
	)
);

export const BlueprintContextSchema = Schema.Struct({
	props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
	state: Schema.Record({ key: Schema.String, value: Schema.Object }),
	portals: PortalsSchema,
});

export const BlueprintDefSchema = Schema.Struct({
	_tag: Schema.Literal('Blueprint'),
	name: Schema.optional(Schema.String),
	props: Schema.optional(
		Schema.Record({ key: Schema.String, value: Schema.Unknown })
	),
	state: Schema.optional(Schema.Unknown),
	view: Schema.Unknown,
	error: Schema.optional(Schema.Unknown),
	loading: Schema.optional(Schema.Unknown),
});

export const BlueprintNodeSchema = BaseNodeSchema.pipe(
	Schema.extend(
		Schema.Struct({
			type: Schema.Literal(NodeType.BLUEPRINT),
			blueprint: BlueprintDefSchema,
			props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
			portals: Schema.Union(PortalsSchema, Schema.Null),
		})
	)
);

export const ListNodeSchema = BaseNodeSchema.pipe(
	Schema.extend(
		Schema.Struct({
			type: Schema.Literal(NodeType.LIST),
			children: Schema.Array(EffuseChildSchema),
		})
	)
);

export const EffuseNodeSchema = Schema.Union(
	ElementNodeSchema,
	TextNodeSchema,
	FragmentNodeSchema,
	BlueprintNodeSchema,
	ListNodeSchema
);

export type PortalFn = Schema.Schema.Type<typeof PortalFnSchema>;
export type Portals = Schema.Schema.Type<typeof PortalsSchema>;
export type ElementNode = Schema.Schema.Type<typeof ElementNodeSchema>;
export type TextNode = Schema.Schema.Type<typeof TextNodeSchema>;
export type FragmentNode = Schema.Schema.Type<typeof FragmentNodeSchema>;
export type BlueprintNode = Schema.Schema.Type<typeof BlueprintNodeSchema>;
export type ListNode = Schema.Schema.Type<typeof ListNodeSchema>;
export type EffuseNode = Schema.Schema.Type<typeof EffuseNodeSchema>;
export type EffuseChild = Schema.Schema.Type<typeof EffuseChildSchema>;
export type BlueprintContext = Schema.Schema.Type<
	typeof BlueprintContextSchema
>;
export type BlueprintDef = Schema.Schema.Type<typeof BlueprintDefSchema>;
