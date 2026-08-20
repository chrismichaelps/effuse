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

/** One stage a request may write after a list field. */
export interface PipelineOperatorDescription {
	readonly name: string;
	readonly description: string;
	readonly arguments: readonly string[];
	readonly appliesTo: string;
}

/**
 * The pipeline stages this runtime understands.
 *
 * A catalog can be extended with stages of its own; these are the ones the
 * language itself defines, and the ones a client can count on.
 */
export const PIPELINE_OPERATORS: readonly PipelineOperatorDescription[] = [
	{
		name: 'filter',
		description: 'Keep the rows a condition holds for.',
		arguments: ['condition'],
		appliesTo: 'list',
	},
	{
		name: 'sort',
		description: 'Order rows by a field path, ascending unless told otherwise.',
		arguments: ['path', 'direction'],
		appliesTo: 'list',
	},
	{
		name: 'take',
		description: 'Keep the first n rows.',
		arguments: ['count'],
		appliesTo: 'list',
	},
	{
		name: 'skip',
		description: 'Drop the first n rows.',
		arguments: ['count'],
		appliesTo: 'list',
	},
	{
		name: 'page',
		description:
			'Cut a page out of the rows, returning the standard page shape.',
		arguments: ['first', 'after', 'last', 'before'],
		appliesTo: 'connection',
	},
	{
		name: 'unique',
		description: 'Drop rows already seen.',
		arguments: [],
		appliesTo: 'list',
	},
];

/** One thing the specification leaves optional. */
export interface FeatureDescription {
	readonly name: string;
	readonly description: string;
	readonly supported: boolean;
}

/**
 * The optional features of the specification, and whether this runtime has
 * them, so a client can find out rather than guess.
 */
export const OPTIONAL_FEATURES: readonly FeatureDescription[] = [
	{
		name: 'costAnalysis',
		description:
			'Requests are priced before they run, and can be refused for cost or depth.',
		supported: true,
	},
	{
		name: 'differentialLive',
		description:
			'A live operation can send only what changed since the snapshot before it.',
		supported: true,
	},
	{
		name: 'transactions',
		description:
			'A mutation can group fields in a transaction block, which run in order.',
		supported: true,
	},
	{
		name: 'introspection',
		description: 'The catalog describes itself through __schema and __type.',
		supported: true,
	},
];
