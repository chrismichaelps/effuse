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

import { Config } from 'effect';

export const TransitionConfig = Config.all({
	enterMs: Config.integer('EFFUSE_TRANSITION_ENTER_MS').pipe(
		Config.withDefault(300)
	),
	exitMs: Config.integer('EFFUSE_TRANSITION_EXIT_MS').pipe(
		Config.withDefault(200)
	),
	moveMs: Config.integer('EFFUSE_TRANSITION_MOVE_MS').pipe(
		Config.withDefault(300)
	),
});

export const CacheConfig = Config.all({
	maxSize: Config.integer('EFFUSE_CACHE_MAX_SIZE').pipe(Config.withDefault(10)),
	ttlMs: Config.integer('EFFUSE_CACHE_TTL_MS').pipe(Config.withDefault(60_000)),
});

export const TransitionDefaults = {
	ENTER_MS: 300,
	EXIT_MS: 200,
	MOVE_MS: 300,
} as const;

export const CacheDefaults = {
	MAX_SIZE: 10,
	TTL_MS: 60_000,
} as const;

export const TransitionClassPrefixes = {
	TRANSITION: 'transition',
	LIST: 'list',
} as const;

export const TransitionClassSuffixes = {
	ENTER: '-enter',
	ENTER_ACTIVE: '-enter-active',
	ENTER_TO: '-enter-to',
	EXIT: '-exit',
	EXIT_ACTIVE: '-exit-active',
	EXIT_TO: '-exit-to',
	MOVE: '-move',
} as const;
