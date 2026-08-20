/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { LexerLayer, NexLanguageLayer, ParserLayer } from '../layers/index.js';
import {
	LexerService,
	ParserService,
	PrinterService,
} from '../services/index.js';

describe('language layer', () => {
	it('provides the lexer, parser, and printer from one layer', () => {
		const printed = Effect.runSync(
			Effect.gen(function* () {
				yield* LexerService;
				const parser = yield* ParserService;
				const printer = yield* PrinterService;
				return yield* printer.print(yield* parser.parse('{user{id}}'));
			}).pipe(Effect.provide(NexLanguageLayer))
		);

		expect(printed).toBe('{\n  user {\n    id\n  }\n}');
	});

	it('lets an embedder swap the token source without touching the grammar', () => {
		let calls = 0;
		const RecordingLexer = Layer.effect(
			LexerService,
			Effect.gen(function* () {
				const inner = yield* LexerService;
				return {
					tokenize: (source: string) => {
						calls += 1;
						return inner.tokenize(source);
					},
				};
			})
		).pipe(Layer.provide(LexerLayer));

		const document = Effect.runSync(
			Effect.gen(function* () {
				const parser = yield* ParserService;
				return yield* parser.parse('{ user }');
			}).pipe(Effect.provide(ParserLayer.pipe(Layer.provide(RecordingLexer))))
		);

		expect(document.definitions).toHaveLength(1);
		expect(calls).toBe(1);
	});
});
