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

import { Config, Effect } from 'effect';
import type { LogLevel } from './types.js';

export const DevToolsConfig = {
	enabled: Config.boolean('EFFUSE_DEVTOOLS_ENABLED').pipe(
		Config.withDefault(false)
	),
	logLevel: Config.literal(
		'debug',
		'info',
		'warn',
		'error'
	)('EFFUSE_DEVTOOLS_LOG_LEVEL').pipe(Config.withDefault('info' as LogLevel)),
	maxLogs: Config.integer('EFFUSE_DEVTOOLS_MAX_LOGS').pipe(
		Config.withDefault(1000)
	),
};

export const loadDevToolsConfig = Effect.all({
	enabled: DevToolsConfig.enabled,
	logLevel: DevToolsConfig.logLevel,
	maxLogs: DevToolsConfig.maxLogs,
}).pipe(
	Effect.catchAll(() =>
		Effect.succeed({
			enabled: false,
			logLevel: 'info' as LogLevel,
			maxLogs: 1000,
		})
	)
);

export type DevToolsConfigType = Effect.Effect.Success<
	typeof loadDevToolsConfig
>;
