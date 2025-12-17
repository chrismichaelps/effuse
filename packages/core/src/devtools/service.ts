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

import { Context, Effect, Layer, Ref, pipe } from 'effect';
import type {
	DevToolsCategory,
	DevToolsState,
	LogEntry,
	LogLevel,
} from './types.js';
import { loadDevToolsConfig } from './config.js';

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const CATEGORY_LABELS: Record<DevToolsCategory, string> = {
	reactivity: 'Reactivity',
	render: 'Render',
	router: 'Router',
	store: 'Store',
	effect: 'Effect',
	lifecycle: 'Lifecycle',
	ink: 'Ink',
};

const shouldLog = (current: LogLevel, target: LogLevel): boolean =>
	LOG_LEVELS[target] >= LOG_LEVELS[current];

const formatMessage = (category: DevToolsCategory, message: string): string =>
	`[Effuse:${CATEGORY_LABELS[category]}] ${message}`;

const writeToConsole = (
	level: LogLevel,
	formatted: string,
	data?: unknown
): Effect.Effect<void> =>
	Effect.sync(() => {
		const method = level === 'debug' || level === 'info' ? 'log' : level;
		if (data !== undefined) {
			console[method](formatted, data);
		} else {
			console[method](formatted);
		}
	});

export interface DevToolsService {
	readonly log: (
		category: DevToolsCategory,
		message: string,
		data?: unknown
	) => Effect.Effect<void>;
	readonly warn: (
		category: DevToolsCategory,
		message: string,
		data?: unknown
	) => Effect.Effect<void>;
	readonly error: (
		category: DevToolsCategory,
		message: string,
		data?: unknown
	) => Effect.Effect<void>;
	readonly debug: (
		category: DevToolsCategory,
		message: string,
		data?: unknown
	) => Effect.Effect<void>;
	readonly enable: () => Effect.Effect<void>;
	readonly disable: () => Effect.Effect<void>;
	readonly setLogLevel: (level: LogLevel) => Effect.Effect<void>;
	readonly isEnabled: () => Effect.Effect<boolean>;
	readonly getLogLevel: () => Effect.Effect<LogLevel>;
	readonly getLogs: () => Effect.Effect<readonly LogEntry[]>;
	readonly clearLogs: () => Effect.Effect<void>;
}

export class DevTools extends Context.Tag('effuse/DevTools')<
	DevTools,
	DevToolsService
>() {}

const createInitialState = (config: {
	enabled: boolean;
	logLevel: LogLevel;
	maxLogs: number;
}): DevToolsState => ({
	enabled: config.enabled,
	logLevel: config.logLevel,
	logs: [],
	maxLogs: config.maxLogs,
});

export const makeDevToolsService = Effect.gen(function* () {
	const config = yield* loadDevToolsConfig;
	const stateRef = yield* Ref.make<DevToolsState>(createInitialState(config));

	const logWithLevel = (
		level: LogLevel,
		category: DevToolsCategory,
		message: string,
		data?: unknown
	): Effect.Effect<void> =>
		pipe(
			Ref.get(stateRef),
			Effect.flatMap((state) => {
				if (!state.enabled) return Effect.void;
				if (!shouldLog(state.logLevel, level)) return Effect.void;

				const entry: LogEntry = {
					category,
					level,
					message,
					data,
					timestamp: new Date(),
				};

				return pipe(
					Ref.update(stateRef, (s) => ({
						...s,
						logs: [...s.logs.slice(-(s.maxLogs - 1)), entry],
					})),
					Effect.andThen(
						writeToConsole(level, formatMessage(category, message), data)
					)
				);
			})
		);

	const service: DevToolsService = {
		log: (category, message, data) =>
			logWithLevel('info', category, message, data),
		warn: (category, message, data) =>
			logWithLevel('warn', category, message, data),
		error: (category, message, data) =>
			logWithLevel('error', category, message, data),
		debug: (category, message, data) =>
			logWithLevel('debug', category, message, data),

		enable: () =>
			pipe(
				Ref.update(stateRef, (s) => ({ ...s, enabled: true })),
				Effect.tap(() =>
					Effect.sync(() => {
						console.log('[Effuse DevTools] Enabled');
					})
				)
			),

		disable: () => Ref.update(stateRef, (s) => ({ ...s, enabled: false })),

		setLogLevel: (level) =>
			Ref.update(stateRef, (s) => ({ ...s, logLevel: level })),

		isEnabled: () =>
			pipe(
				Ref.get(stateRef),
				Effect.map((s) => s.enabled)
			),

		getLogLevel: () =>
			pipe(
				Ref.get(stateRef),
				Effect.map((s) => s.logLevel)
			),

		getLogs: () =>
			pipe(
				Ref.get(stateRef),
				Effect.map((s) => s.logs)
			),

		clearLogs: () => Ref.update(stateRef, (s) => ({ ...s, logs: [] })),
	};

	return service;
});

export const DevToolsLive: Layer.Layer<DevTools> = Layer.effect(
	DevTools,
	makeDevToolsService
);
