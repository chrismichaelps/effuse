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

import type { PipelineStageNode } from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { printExpression } from './expression.js';
import { printValue } from './value.js';

/** Render one pipeline stage, without its leading pipe. */
export const printStage = (stage: PipelineStageNode): string => {
	switch (stage.kind) {
		case Kind.FILTER_STAGE:
			return `filter ${printExpression(stage.condition)}`;
		case Kind.SORT_STAGE:
			return `sort ${printExpression(stage.field)} ${stage.direction}`;
		case Kind.TAKE_STAGE:
			return `take ${printValue(stage.count)}`;
		case Kind.SKIP_STAGE:
			return `skip ${printValue(stage.count)}`;
		case Kind.PAGE_STAGE:
			return `page ${stage.arguments
				.map(
					(argument) => `${argument.name.value}: ${printValue(argument.value)}`
				)
				.join(', ')}`;
		case Kind.UNIQUE_STAGE:
			return 'unique';
		case Kind.CUSTOM_STAGE:
			return `${stage.name.value} ${stage.arguments
				.map(
					(argument) => `${argument.name.value}: ${printValue(argument.value)}`
				)
				.join(', ')}`.trimEnd();
	}
};
