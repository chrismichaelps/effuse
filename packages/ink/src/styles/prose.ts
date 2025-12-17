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

import type { EffuseLayer } from '@effuse/core';

export const InkProseLayer: EffuseLayer = {
	name: 'ink-prose',
	styles: [
		`
.prose {
	max-width: 65ch;
	line-height: 1.75;
	color: inherit;
}

.prose h1, .prose .ink-h1 {
	font-size: 2.25rem;
	font-weight: 700;
	margin: 2rem 0 1rem;
	line-height: 1.2;
}

.prose h2, .prose .ink-h2 {
	font-size: 1.5rem;
	font-weight: 600;
	margin: 1.75rem 0 0.75rem;
	line-height: 1.3;
}

.prose h3, .prose .ink-h3 {
	font-size: 1.25rem;
	font-weight: 600;
	margin: 1.5rem 0 0.5rem;
}

.prose h4, .prose .ink-h4 {
	font-size: 1rem;
	font-weight: 600;
	margin: 1.25rem 0 0.5rem;
}

.prose h5, .prose .ink-h5,
.prose h6, .prose .ink-h6 {
	font-size: 0.875rem;
	font-weight: 600;
	margin: 1rem 0 0.5rem;
}

.prose p, .prose .ink-p {
	margin: 1rem 0;
}

.prose a, .prose .ink-link {
	color: #667eea;
	text-decoration: underline;
	text-underline-offset: 2px;
	transition: color 0.2s;
}

.prose a:hover, .prose .ink-link:hover {
	color: #764ba2;
}

.prose code, .prose .ink-inline-code {
	background: rgba(102, 126, 234, 0.1);
	padding: 0.2em 0.4em;
	border-radius: 4px;
	font-size: 0.875em;
	font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
}

.prose pre, .prose .ink-code-block {
	background: #1a1a2e;
	padding: 1rem 1.25rem;
	border-radius: 8px;
	overflow-x: auto;
	margin: 1.5rem 0;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.prose pre code {
	background: transparent;
	padding: 0;
	font-size: 0.875rem;
	line-height: 1.6;
}

.prose blockquote, .prose .ink-blockquote {
	border-left: 4px solid #667eea;
	padding-left: 1rem;
	margin: 1.5rem 0;
	color: rgba(255, 255, 255, 0.7);
	font-style: italic;
}

.prose blockquote p {
	margin: 0.5rem 0;
}

.prose ul, .prose .ink-ul {
	list-style-type: disc;
	padding-left: 1.5rem;
	margin: 1rem 0;
}

.prose ol, .prose .ink-ol {
	list-style-type: decimal;
	padding-left: 1.5rem;
	margin: 1rem 0;
}

.prose li, .prose .ink-list-item {
	margin: 0.25rem 0;
	padding-left: 0.25rem;
}

.prose ul ul, .prose ol ol, .prose ul ol, .prose ol ul {
	margin: 0.25rem 0;
}

.prose .ink-task-item {
	list-style: none;
	margin-left: -1.5rem;
	padding-left: 0;
	display: flex;
	align-items: baseline;
	gap: 0.5rem;
}

.prose .ink-task-text {
	display: inline;
}

.prose .ink-task-checkbox {
	flex-shrink: 0;
	accent-color: #667eea;
}

.prose hr, .prose .ink-hr {
	border: none;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
	margin: 2rem 0;
}

.prose img, .prose .ink-image {
	max-width: 100%;
	height: auto;
	border-radius: 8px;
	margin: 1.5rem 0;
}

.prose table {
	width: 100%;
	border-collapse: collapse;
	margin: 1.5rem 0;
}

.prose th, .prose td {
	border: 1px solid rgba(255, 255, 255, 0.1);
	padding: 0.75rem 1rem;
	text-align: left;
}

.prose th {
	background: rgba(102, 126, 234, 0.1);
	font-weight: 600;
}

.prose tbody tr:hover {
	background: rgba(255, 255, 255, 0.02);
}

.prose strong, .prose b {
	font-weight: 600;
}

.prose em, .prose i {
	font-style: italic;
}

.prose del, .prose s {
	text-decoration: line-through;
	opacity: 0.7;
}

.prose .ink-unknown-component {
	background: rgba(233, 69, 96, 0.1);
	border: 1px dashed #e94560;
	border-radius: 4px;
	padding: 0.5rem 1rem;
	color: #e94560;
	font-size: 0.875rem;
	margin: 0.5rem 0;
}


.prose .ink-hl-keyword {
	color: #c678dd;
	font-weight: 500;
}

.prose .ink-hl-string {
	color: #98c379;
}

.prose .ink-hl-number {
	color: #d19a66;
}

.prose .ink-hl-comment {
	color: #5c6370;
	font-style: italic;
}

.prose .ink-hl-function {
	color: #61afef;
}

.prose .ink-hl-class {
	color: #e5c07b;
}

.prose .ink-hl-type {
	color: #e5c07b;
}

.prose .ink-hl-variable {
	color: #e06c75;
}

.prose .ink-hl-operator {
	color: #56b6c2;
}

.prose .ink-hl-punctuation {
	color: #abb2bf;
}

.prose .ink-hl-property {
	color: #e06c75;
}

.prose .ink-hl-selector {
	color: #e06c75;
}

.prose .ink-hl-tag {
	color: #e06c75;
}

.prose .ink-hl-attr-name {
	color: #d19a66;
}

.prose .ink-hl-attr-value {
	color: #98c379;
}


.prose .ink-table {
	width: 100%;
	border-collapse: collapse;
	margin: 1.5rem 0;
}

.prose .ink-th,
.prose .ink-td {
	border: 1px solid rgba(255, 255, 255, 0.1);
	padding: 0.75rem 1rem;
}

.prose .ink-th {
	background: rgba(102, 126, 234, 0.1);
	font-weight: 600;
}

.prose .ink-tbody .ink-tr:hover {
	background: rgba(255, 255, 255, 0.02);
}
`,
	],
};
