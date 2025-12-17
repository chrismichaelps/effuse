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

import { Effect } from 'effect';
import type { DevToolsCategory, LogEntry, LogLevel } from './types.js';
import { makeDevToolsService, type DevToolsService } from './service.js';

let globalService: DevToolsService | null = null;

const getGlobalService = (): DevToolsService => {
	if (!globalService) {
		globalService = Effect.runSync(makeDevToolsService);
	}
	return globalService;
};

export const devtools = {
	log: (category: DevToolsCategory, message: string, data?: unknown): void => {
		Effect.runSync(getGlobalService().log(category, message, data));
	},
	warn: (category: DevToolsCategory, message: string, data?: unknown): void => {
		Effect.runSync(getGlobalService().warn(category, message, data));
	},
	error: (
		category: DevToolsCategory,
		message: string,
		data?: unknown
	): void => {
		Effect.runSync(getGlobalService().error(category, message, data));
	},
	debug: (
		category: DevToolsCategory,
		message: string,
		data?: unknown
	): void => {
		Effect.runSync(getGlobalService().debug(category, message, data));
	},
	enable: (): void => {
		Effect.runSync(getGlobalService().enable());
	},
	disable: (): void => {
		Effect.runSync(getGlobalService().disable());
	},
	setLogLevel: (level: LogLevel): void => {
		Effect.runSync(getGlobalService().setLogLevel(level));
	},
	isEnabled: (): boolean => {
		return Effect.runSync(getGlobalService().isEnabled());
	},
	getLogs: (): readonly LogEntry[] => {
		return Effect.runSync(getGlobalService().getLogs());
	},
	clearLogs: (): void => {
		Effect.runSync(getGlobalService().clearLogs());
	},
};

if (typeof window !== 'undefined') {
	const w = window as unknown as { __EFFUSE_DEVTOOLS__?: typeof devtools };
	w.__EFFUSE_DEVTOOLS__ = devtools;
}
