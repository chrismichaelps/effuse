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

import { define, computed, type ReadonlySignal } from '@effuse/core';
import { parseSync } from '../parser/index.js';
import { transformDocument, type InkComponents } from './transformer.js';
import type { InkProps, DocumentNode } from '../types/ast.js';

interface InkExposed {
	ast: ReadonlySignal<DocumentNode>;
	componentMap: InkComponents;
	className: string;
	renderedContent: ReadonlySignal<ReturnType<typeof transformDocument>>;
}

// Build markdown renderer component
export const Ink = define<InkProps, InkExposed>({
	script: ({ props }) => {
		const ast = computed<DocumentNode>(() => {
			const content =
				typeof props.content === 'string'
					? props.content
					: ((props.content as { value?: string }).value ?? '');

			return parseSync(content);
		});

		const componentMap = (props.components ?? {}) as InkComponents;
		const className = props.class ?? '';

		const renderedContent = computed(() => {
			return transformDocument(ast.value, componentMap);
		});

		return {
			ast,
			componentMap,
			className,
			renderedContent,
		};
	},

	template: (exposed: InkExposed) => (
		<div class={() => `prose ${exposed.className}`.trim()}>
			{exposed.renderedContent}
		</div>
	),
});
