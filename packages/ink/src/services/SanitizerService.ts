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

import { Effect, Context, Layer } from 'effect';
import { loadInkConfig } from '../config/InkConfig.js';
import type { SanitizationError } from '../types/errors.js';

const DANGEROUS_PATTERNS = [
	/<script\b[^>]*>[\s\S]*?<\/script>/gi,
	/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
	/<object\b[^>]*>[\s\S]*?<\/object>/gi,
	/<embed\b[^>]*>/gi,
	/<link\b[^>]*>/gi,
	/javascript:/gi,
	/data:text\/html/gi,
	/on\w+\s*=/gi,
];

export interface SanitizerServiceInterface {
	readonly sanitize: (
		content: string
	) => Effect.Effect<string, SanitizationError>;
	readonly isContentSafe: (content: string) => Effect.Effect<boolean>;
}

export class SanitizerService extends Context.Tag('ink/SanitizerService')<
	SanitizerService,
	SanitizerServiceInterface
>() {}

const containsDangerousContent = (content: string): string | null => {
	for (const pattern of DANGEROUS_PATTERNS) {
		pattern.lastIndex = 0;
		const match = pattern.exec(content);
		if (match) {
			return match[0];
		}
	}
	return null;
};

const stripDangerousContent = (content: string): string => {
	let result = content;
	for (const pattern of DANGEROUS_PATTERNS) {
		result = result.replace(pattern, '');
	}
	return result;
};

const make: SanitizerServiceInterface = {
	sanitize: (content: string) =>
		Effect.gen(function* () {
			const config = yield* Effect.orDie(loadInkConfig);

			if (!config.sanitize) {
				return content;
			}

			const dangerous = containsDangerousContent(content);
			if (dangerous) {
				const sanitized = stripDangerousContent(content);
				return sanitized;
			}
			return content;
		}),

	isContentSafe: (content: string) =>
		Effect.succeed(containsDangerousContent(content) === null),
};

export const SanitizerServiceLive = Layer.succeed(SanitizerService, make);

export const sanitizeContent = (
	content: string
): Effect.Effect<string, SanitizationError, SanitizerService> =>
	Effect.gen(function* () {
		const sanitizer = yield* SanitizerService;
		return yield* sanitizer.sanitize(content);
	});
