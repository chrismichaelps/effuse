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

export const MetaTagSchema = Schema.Struct({
	name: Schema.optional(Schema.String),
	property: Schema.optional(Schema.String),
	content: Schema.String,
	httpEquiv: Schema.optional(Schema.String),
});

export const LinkTagSchema = Schema.Struct({
	rel: Schema.String,
	href: Schema.String,
	type: Schema.optional(Schema.String),
	crossOrigin: Schema.optional(
		Schema.Union(Schema.Literal('anonymous'), Schema.Literal('use-credentials'))
	),
});

export const ScriptTagSchema = Schema.Struct({
	src: Schema.optional(Schema.String),
	content: Schema.optional(Schema.String),
	type: Schema.optional(Schema.String),
	async: Schema.optional(Schema.Boolean),
	defer: Schema.optional(Schema.Boolean),
	id: Schema.optional(Schema.String),
});

export const OpenGraphPropsSchema = Schema.Struct({
	title: Schema.optional(Schema.String),
	description: Schema.optional(Schema.String),
	type: Schema.optional(Schema.String),
	url: Schema.optional(Schema.String),
	image: Schema.optional(Schema.String),
	siteName: Schema.optional(Schema.String),
	locale: Schema.optional(Schema.String),
});

export const TwitterCardPropsSchema = Schema.Struct({
	card: Schema.optional(
		Schema.Union(
			Schema.Literal('summary'),
			Schema.Literal('summary_large_image'),
			Schema.Literal('app'),
			Schema.Literal('player')
		)
	),
	site: Schema.optional(Schema.String),
	creator: Schema.optional(Schema.String),
	title: Schema.optional(Schema.String),
	description: Schema.optional(Schema.String),
	image: Schema.optional(Schema.String),
});

export const HeadPropsSchema = Schema.Struct({
	title: Schema.optional(Schema.String),
	description: Schema.optional(Schema.String),
	canonical: Schema.optional(Schema.String),
	viewport: Schema.optional(Schema.String),
	charset: Schema.optional(Schema.String),
	lang: Schema.optional(Schema.String),
	themeColor: Schema.optional(Schema.String),
	favicon: Schema.optional(Schema.String),
	og: Schema.optional(OpenGraphPropsSchema),
	twitter: Schema.optional(TwitterCardPropsSchema),
	meta: Schema.optional(Schema.Array(MetaTagSchema)),
	link: Schema.optional(Schema.Array(LinkTagSchema)),
	script: Schema.optional(Schema.Array(ScriptTagSchema)),
	base: Schema.optional(Schema.String),
	robots: Schema.optional(Schema.String),
});

export const parseHeadProps = Schema.decodeUnknownEither(HeadPropsSchema);

export const encodeHeadProps = Schema.encodeUnknownEither(HeadPropsSchema);
