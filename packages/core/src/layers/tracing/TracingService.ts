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

/* eslint-disable no-console */
import { Context, Effect, Layer } from 'effect';
import {
	type TracingCategories,
	type TracingCategory,
	defaultCategories,
	isCategoryEnabled,
} from './categories.js';

export interface TracingConfig {
	readonly enabled: boolean;
	readonly serviceName: string;
	readonly console: boolean;
	readonly verbose: boolean;
	readonly categories?: Partial<TracingCategories>;
}

const defaultConfig: TracingConfig = {
	enabled: false,
	serviceName: 'effuse-app',
	console: true,
	verbose: false,
	categories: defaultCategories,
};

const styles = {
	label: 'color: gray; font-weight: lighter;',
	name: 'color: inherit; font-weight: bold;',
	time: 'color: gray; font-weight: lighter;',
	prevState: 'color: #9E9E9E; font-weight: bold;',
	action: 'color: #03A9F4; font-weight: bold;',
	nextState: 'color: #4CAF50; font-weight: bold;',
};

export interface TracingServiceApi {
	readonly config: TracingConfig;
	readonly isEnabled: () => boolean;
	readonly isCategoryEnabled: (category: TracingCategory) => boolean;
	readonly startSpan: (
		name: string,
		attributes?: Record<string, unknown>
	) => void;
	readonly endSpan: (name: string) => void;
	readonly logSpan: (
		name: string,
		duration: number,
		attributes?: Record<string, unknown>,
		depth?: number
	) => void;
	readonly log: (
		category: TracingCategory,
		type: string,
		name: string,
		data?: Record<string, unknown>
	) => void;
	readonly logWithDuration: (
		category: TracingCategory,
		type: string,
		name: string,
		duration: number,
		data?: Record<string, unknown>
	) => void;
}

export class TracingService extends Context.Tag('TracingService')<
	TracingService,
	TracingServiceApi
>() {}

export const createTracingService = (
	config: Partial<TracingConfig> = {}
): TracingServiceApi => {
	const mergedConfig: TracingConfig = {
		...defaultConfig,
		...config,
		categories: { ...defaultCategories, ...config.categories },
	};
	const spans = new Map<
		string,
		{ start: number; attributes: Record<string, unknown> | undefined }
	>();

	const checkCategory = (category: TracingCategory): boolean =>
		mergedConfig.enabled &&
		mergedConfig.console &&
		isCategoryEnabled(mergedConfig.categories, category);

	return {
		config: mergedConfig,

		isEnabled: () => mergedConfig.enabled,

		isCategoryEnabled: (category: TracingCategory) => checkCategory(category),

		startSpan: (name: string, attributes?: Record<string, unknown>) => {
			if (!mergedConfig.enabled) return;
			spans.set(name, { start: performance.now(), attributes });
		},

		endSpan: (name: string) => {
			if (!mergedConfig.enabled) return;
			spans.delete(name);
		},

		logSpan: (
			name: string,
			duration: number,
			attributes?: Record<string, unknown>,
			_depth = 0
		) => {
			if (!checkCategory('layers')) return;

			const time = new Date().toLocaleTimeString();
			const depsAttr = attributes?.['depends'] as string[] | undefined;
			const depsStr = depsAttr ? ` <- [${depsAttr.join(', ')}]` : '';

			console.groupCollapsed(
				`%clayer %c${name}${depsStr} %c@ ${time} (${duration.toFixed(2)}ms)`,
				styles.label,
				styles.name,
				styles.time
			);

			if (attributes) {
				if (attributes['layer']) {
					console.log('%clayer', styles.prevState, attributes['layer']);
				}
				if (depsAttr) {
					console.log('%cdepends', styles.action, depsAttr);
				}
				if (attributes['provides']) {
					console.log('%cprovides', styles.nextState, attributes['provides']);
				}
			}

			console.log('%cduration', styles.nextState, `${duration.toFixed(2)}ms`);
			console.groupEnd();
		},

		log: (
			category: TracingCategory,
			type: string,
			name: string,
			data?: Record<string, unknown>
		) => {
			if (!checkCategory(category)) return;

			const time = new Date().toLocaleTimeString();

			console.groupCollapsed(
				`%c${category} %c${type} %c${name} %c@ ${time}`,
				styles.label,
				styles.action,
				styles.name,
				styles.time
			);

			if (data) {
				for (const [key, value] of Object.entries(data)) {
					console.log(`%c${key}`, styles.action, value);
				}
			}

			console.groupEnd();
		},

		logWithDuration: (
			category: TracingCategory,
			type: string,
			name: string,
			duration: number,
			data?: Record<string, unknown>
		) => {
			if (!checkCategory(category)) return;

			const time = new Date().toLocaleTimeString();

			console.groupCollapsed(
				`%c${category} %c${type} %c${name} %c@ ${time} (${duration.toFixed(2)}ms)`,
				styles.label,
				styles.action,
				styles.name,
				styles.time
			);

			if (data) {
				for (const [key, value] of Object.entries(data)) {
					console.log(`%c${key}`, styles.action, value);
				}
			}

			console.log('%cduration', styles.nextState, `${duration.toFixed(2)}ms`);
			console.groupEnd();
		},
	};
};

export const TracingServiceLive = (
	config: Partial<TracingConfig> = {}
): Layer.Layer<TracingService> =>
	Layer.succeed(TracingService, createTracingService(config));

export const withTracing = <A, E, R>(
	name: string,
	effect: Effect.Effect<A, E, R>,
	attributes?: Record<string, unknown>
): Effect.Effect<A, E, R | TracingService> =>
	Effect.gen(function* () {
		const tracing = yield* TracingService;
		if (!tracing.isEnabled()) {
			return yield* effect;
		}

		const start = performance.now();
		tracing.startSpan(name, attributes);

		try {
			const result = yield* effect;
			const duration = performance.now() - start;
			tracing.logSpan(name, duration, attributes);
			return result;
		} finally {
			tracing.endSpan(name);
		}
	});
