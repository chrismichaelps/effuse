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

import { Layer } from 'effect';
import { AnalyzerLayer } from './analyzer.js';
import { CatalogLayer } from './catalog.js';
import { ExecutorLayer } from './executor.js';
import { LexerLayer } from './lexer.js';
import { ParserLayer } from './parser.js';
import { PrinterLayer } from './printer.js';
import { RequestValidatorLayer } from './request-validator.js';
import { ValidatorLayer } from './validator.js';

/**
 * The language dependency graph.
 *
 * ```text
 * LexerLayer ──▶ ParserLayer ─────┐
 * PrinterLayer ───────────────────┤
 * ValidatorLayer ─────────────────┼──▶ NexLanguageLayer
 * CatalogLayer ───────────────────┤
 * RequestValidatorLayer ──────────┤
 * AnalyzerLayer ──────────────────┤
 * ExecutorLayer ──────────────────┘
 * ```
 *
 * `ParserLayer` is the only node with a dependency; providing `LexerLayer`
 * with `provideMerge` satisfies it while keeping the lexer available to
 * callers of the composed layer.
 */
export const NexLanguageLayer = Layer.mergeAll(
	ParserLayer.pipe(Layer.provideMerge(LexerLayer)),
	PrinterLayer,
	ValidatorLayer,
	RequestValidatorLayer,
	CatalogLayer,
	AnalyzerLayer,
	ExecutorLayer
);
