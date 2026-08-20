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

import type { ValueNode } from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { printBlockString, printString } from '../../utils/index.js';

/** Render a value literal. */
export const printValue = (value: ValueNode): string => {
	switch (value.kind) {
		case Kind.VARIABLE:
			return `$${value.name.value}`;
		case Kind.INT:
		case Kind.FLOAT:
			return value.value;
		case Kind.STRING:
			return value.block === true
				? printBlockString(value.value)
				: printString(value.value);
		case Kind.BOOLEAN:
			return value.value ? 'true' : 'false';
		case Kind.NULL:
			return 'null';
		case Kind.ENUM:
			return value.value;
		case Kind.LIST:
			return `[${value.values.map(printValue).join(', ')}]`;
		case Kind.OBJECT:
			return value.fields.length === 0
				? '{}'
				: `{ ${value.fields
						.map((field) => `${field.name.value}: ${printValue(field.value)}`)
						.join(', ')} }`;
	}
};
