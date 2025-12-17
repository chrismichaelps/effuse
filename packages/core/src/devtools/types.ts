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

export const LogLevelSchema = Schema.Literal('debug', 'info', 'warn', 'error');
export type LogLevel = Schema.Schema.Type<typeof LogLevelSchema>;

export const DevToolsCategorySchema = Schema.Literal(
	'reactivity',
	'render',
	'router',
	'store',
	'effect',
	'lifecycle',
	'ink'
);
export type DevToolsCategory = Schema.Schema.Type<
	typeof DevToolsCategorySchema
>;

export const LogEntrySchema = Schema.Struct({
	category: DevToolsCategorySchema,
	level: LogLevelSchema,
	message: Schema.String,
	data: Schema.optional(Schema.Unknown),
	timestamp: Schema.Date,
});
export type LogEntry = Schema.Schema.Type<typeof LogEntrySchema>;

export const DevToolsStateSchema = Schema.Struct({
	enabled: Schema.Boolean,
	logLevel: LogLevelSchema,
	logs: Schema.Array(LogEntrySchema),
	maxLogs: Schema.Number,
});
export type DevToolsState = Schema.Schema.Type<typeof DevToolsStateSchema>;
