/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { Chunk, Effect, Either, Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { DocumentNodeSchema } from '../schema/index.js';
import { Kind } from '../language/kinds/index.js';
import { LexerLayer, NexLanguageLayer } from '../layers/index.js';
import { LexerService, ParserService } from '../services/index.js';

const parse = (source: string) =>
	Effect.runSync(
		Effect.gen(function* () {
			const parser = yield* ParserService;
			return yield* parser.parse(source);
		}).pipe(Effect.provide(NexLanguageLayer))
	);

const decodeDocument = Schema.decodeUnknownEither(DocumentNodeSchema);

describe('AST schemas', () => {
	it('accepts everything the parser produces', () => {
		const document = parse(
			`query GetPosts($status: Status = PUBLISHED, $limit: Int = 10) @cost(value: 5) {
				owner: user(id: $id) {
					...UserCard
					... on Admin { level }
					posts
						| filter status == $status and not (archived == true)
						| sort createdAt desc
						| page first: $limit after: $cursor {
							title
							meta: raw(shape: { tags: ["a"], deep: null, ratio: 1.5 })
						}
				}
			}
			fragment UserCard on User { id name }`
		);

		expect(Either.isRight(decodeDocument(document))).toBe(true);
	});

	it('rejects a document carrying an unknown node kind', () => {
		const result = decodeDocument({
			kind: Kind.DOCUMENT,
			definitions: [{ kind: 'Nope' }],
		});

		expect(Either.isLeft(result)).toBe(true);
	});

	it('rejects a field whose name node is malformed', () => {
		const result = decodeDocument({
			kind: Kind.DOCUMENT,
			definitions: [
				{
					kind: Kind.OPERATION_DEFINITION,
					operation: 'query',
					selectionSet: {
						kind: Kind.SELECTION_SET,
						selections: [
							{ kind: Kind.FIELD, name: { kind: Kind.NAME, value: 42 } },
						],
					},
				},
			],
		});

		expect(Either.isLeft(result)).toBe(true);
	});

	it('rejects an operation type outside query, mutation, and live', () => {
		const result = decodeDocument({
			kind: Kind.DOCUMENT,
			definitions: [
				{
					kind: Kind.OPERATION_DEFINITION,
					operation: 'subscription',
					selectionSet: {
						kind: Kind.SELECTION_SET,
						selections: [
							{ kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'a' } },
						],
					},
				},
			],
		});

		expect(Either.isLeft(result)).toBe(true);
	});
});

describe('token stream', () => {
	it('is delivered as an Effect Chunk', () => {
		const tokens = Effect.runSync(
			Effect.gen(function* () {
				const lexer = yield* LexerService;
				return yield* lexer.tokenize('{ user }');
			}).pipe(Effect.provide(LexerLayer))
		);

		expect(Chunk.isChunk(tokens)).toBe(true);
		expect(Chunk.size(tokens)).toBe(4);
	});
});
