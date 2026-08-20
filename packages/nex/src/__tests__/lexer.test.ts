/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { Chunk, Effect, Either } from 'effect';
import { describe, expect, it } from 'vitest';
import { NexSyntaxError } from '../errors/index.js';
import { LexerLayer } from '../layers/index.js';
import { LexerService } from '../services/index.js';
import { TokenKind, type Token } from '../language/token/index.js';

const tokenize = (source: string): readonly Token[] =>
	Chunk.toReadonlyArray(
		Effect.runSync(
			Effect.gen(function* () {
				const lexer = yield* LexerService;
				return yield* lexer.tokenize(source);
			}).pipe(Effect.provide(LexerLayer))
		)
	);

const kinds = (source: string): readonly TokenKind[] =>
	tokenize(source).map((token) => token.kind);

describe('lexer', () => {
	it('emits a lone EOF token for an empty document', () => {
		expect(kinds('')).toEqual([TokenKind.EOF]);
	});

	it('reads a name token with its position', () => {
		const [name] = tokenize('user');

		expect(name).toMatchObject({
			kind: TokenKind.NAME,
			value: 'user',
			start: 0,
			end: 4,
			line: 1,
			column: 1,
		});
	});

	it('reads every punctuator used by the language', () => {
		expect(kinds('{ } ( ) [ ] : , = ! ? @ $ | ... . &')).toEqual([
			TokenKind.BRACE_L,
			TokenKind.BRACE_R,
			TokenKind.PAREN_L,
			TokenKind.PAREN_R,
			TokenKind.BRACKET_L,
			TokenKind.BRACKET_R,
			TokenKind.COLON,
			TokenKind.COMMA,
			TokenKind.EQUALS,
			TokenKind.BANG,
			TokenKind.QUESTION,
			TokenKind.AT,
			TokenKind.DOLLAR,
			TokenKind.PIPE,
			TokenKind.SPREAD,
			TokenKind.DOT,
			TokenKind.AMP,
			TokenKind.EOF,
		]);
	});

	it('reads the comparison operators used by filter conditions', () => {
		expect(kinds('== != <= >= < >')).toEqual([
			TokenKind.EQUALS_EQUALS,
			TokenKind.BANG_EQUALS,
			TokenKind.LT_EQUALS,
			TokenKind.GT_EQUALS,
			TokenKind.LT,
			TokenKind.GT,
			TokenKind.EOF,
		]);
	});

	it('distinguishes integers from floats', () => {
		expect(tokenize('10 -3 1.5 6.0221e23 1e-4').slice(0, 5)).toMatchObject([
			{ kind: TokenKind.INT, value: '10' },
			{ kind: TokenKind.INT, value: '-3' },
			{ kind: TokenKind.FLOAT, value: '1.5' },
			{ kind: TokenKind.FLOAT, value: '6.0221e23' },
			{ kind: TokenKind.FLOAT, value: '1e-4' },
		]);
	});

	it('unescapes string values', () => {
		const [text] = tokenize('"line\\nbreak \\u0041 \\"quoted\\""');

		expect(text).toMatchObject({
			kind: TokenKind.STRING,
			value: 'line\nbreak A "quoted"',
		});
	});

	it('reads block strings and strips their common indentation', () => {
		const [text] = tokenize('\"\"\"\n\t\tfirst\n\t\t  second\n\t\t\"\"\"');

		expect(text).toMatchObject({
			kind: TokenKind.BLOCK_STRING,
			value: 'first\n  second',
		});
	});

	it('skips comments to the end of the line', () => {
		expect(kinds('user # trailing comment\nname')).toEqual([
			TokenKind.NAME,
			TokenKind.NAME,
			TokenKind.EOF,
		]);
	});

	it('tracks line and column across newlines', () => {
		const [, second] = tokenize('user\n  name');

		expect(second).toMatchObject({ value: 'name', line: 2, column: 3 });
	});
});

describe('lexer failures', () => {
	const attempt = (source: string) =>
		Effect.runSync(
			Effect.gen(function* () {
				const lexer = yield* LexerService;
				return yield* lexer.tokenize(source);
			}).pipe(Effect.provide(LexerLayer), Effect.either)
		);

	it('reports unexpected characters in the error channel with a location', () => {
		const result = attempt('user\n  %');

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toBeInstanceOf(NexSyntaxError);
			expect(result.left.message).toContain('Unexpected character');
			expect(result.left.location).toEqual({ start: 7, line: 2, column: 3 });
		}
	});

	it('reports an unterminated string at the opening quote', () => {
		const result = attempt('"open');

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left.message).toBe('Unterminated string literal');
			expect(result.left.location.column).toBe(1);
		}
	});

	it('reports an invalid escape sequence', () => {
		const result = attempt('"bad \\q escape"');

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left.message).toBe('Invalid escape sequence: \\q');
		}
	});

	it('never leaks a thrown error past the effect boundary', () => {
		expect(() => attempt('%')).not.toThrow();
	});
});
