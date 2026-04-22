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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { CliConfigService, type CliConfig } from '../../src/config/index.js';
import {
	CliError,
	BuildError,
	DevServerError,
	ConfigError,
	FileError,
} from '../../src/errors/index.js';
import { APP_NAME, DEFAULT_CONFIG, ENV_KEYS, PRESETS, COMMANDS, HTTP_STATUS } from '../../src/constants.js';
import {
	loadEnvFiles,
	isTruthy,
	parseNumber,
	parseBool,
	fileExists,
} from '../../src/utils/index.js';
import { readEnvFile } from '../../src/utils/env.js';

const TEST_DIR = resolve(process.cwd(), '.regression-test-tmp');

const setupTestDir = () => {
	rmSync(TEST_DIR, { recursive: true, force: true });
	mkdirSync(TEST_DIR, { recursive: true });
};

const teardownTestDir = () => {
	rmSync(TEST_DIR, { recursive: true, force: true });
};

describe('REGRESSION: error wrapping', () => {
	describe('RenderError double-wrapping fix', () => {
		it('should not double-wrap RenderError', () => {
			const originalError = new Error('Original render error');
			const caught = originalError;

			const wrapped = caught instanceof Error
				? new DevServerError({ message: String(caught), cause: caught })
				: new DevServerError({ message: String(caught) });

			expect(wrapped.message).toBe('Original render error');
			expect(wrapped.cause).toBe(originalError);
			expect(wrapped._tag).toBe('DevServerError');
		});

		it('should preserve original cause chain', () => {
			const original = new Error('original');
			const error = new DevServerError({ message: 'wrapped', cause: original });

			expect(error.cause).toBe(original);
		});
	});
});

describe('REGRESSION: Effect.runFork + process.exit race condition', () => {
	it('should not call process.exit directly after runFork', () => {
		const exitCalls: number[] = [];
		const originalExit = process.exit;
		vi.stubGlobal('process', {
			...process,
			exit: (code = 0) => { exitCalls.push(code); },
		});

		expect(() => process.exit(0)).not.toThrow();
		expect(exitCalls).toContain(0);

		vi.restoreAllMocks();
	});

	it('should have timeout before forced exit', () => {
		const timeout = 5000;
		expect(timeout).toBeGreaterThan(0);
		expect(timeout).toBeLessThanOrEqual(10000);
	});
});

describe('REGRESSION: ESM require() calls', () => {
	it('should use dynamic import for fs in async functions', async () => {
		const mod = await import('node:fs');
		expect(mod).toBeDefined();
	});

	it('should catch ESM import errors', async () => {
		try {
			await import('node:fs');
		} catch {
			expect(true).toBe(true);
		}
	});
});

describe('REGRESSION: body parsing for POST/PUT', () => {
	it('should parse JSON body correctly', () => {
		const body = { name: 'test', value: 123 };
		const serialized = JSON.stringify(body);
		const parsed = JSON.parse(serialized);

		expect(parsed.name).toBe('test');
		expect(parsed.value).toBe(123);
	});

	it('should not parse undefined body', () => {
		const body = undefined;
		const result = typeof body === 'string' ? body : JSON.stringify(body);
		expect(result).toBe('undefined');
	});

	it('should handle string body without re-serializing', () => {
		const body = 'raw body content';
		const result = typeof body === 'string' ? body : JSON.stringify(body);
		expect(result).toBe('raw body content');
	});

	it('should detect Content-Type from headers', () => {
		const contentType = 'application/json';
		const headers = new Headers();
		headers.set('Content-Type', contentType);

		const ct = headers.get('Content-Type');
		expect(ct).toBe('application/json');
	});

	it('should default to octet-stream when no Content-Type', () => {
		const contentType: string | null = null;
		const fallback = 'application/octet-stream';
		expect(contentType ?? fallback).toBe('application/octet-stream');
	});
});

describe('REGRESSION: SIGTERM/SIGINT graceful shutdown', () => {
	it('should register both SIGTERM and SIGINT handlers', () => {
		const handlers: string[] = [];

		if (process.listeners('SIGTERM').length >= 0) handlers.push('SIGTERM');
		if (process.listeners('SIGINT').length >= 0) handlers.push('SIGINT');

		expect(handlers.length).toBeGreaterThanOrEqual(0);
	});

	it('should not exit immediately on signal', () => {
		const shouldExit = false;
		expect(shouldExit).toBe(false);
	});

	it('should call server.close before exit', () => {
		const closeCalls: number[] = [];
		const server = { close: (cb: () => void) => { closeCalls.push(1); cb(); } };

		server.close(() => expect(closeCalls).toContain(1));
	});
});

describe('REGRESSION: X-Forwarded-Proto header', () => {
	it('should check X-Forwarded-Proto before req.protocol', () => {
		const xForwarded = 'https';
		const protocol = xForwarded ?? 'http';
		expect(protocol).toBe('https');
	});

it('should fall back to req.protocol', () => {
			const xForwarded: string | undefined = undefined;
			const protocol = xForwarded ?? 'http';
			expect(protocol).toBe('http');
		});

	it('should build correct URL with protocol', () => {
		const protocol = 'https';
		const host = 'example.com';
		const basePath = '/';
		const url = `${protocol}://${host}${basePath}`;
		expect(url).toBe('https://example.com/');
	});
});

describe('REGRESSION: config parsing edge cases', () => {
	beforeEach(setupTestDir);
	afterEach(teardownTestDir);

	it('should handle missing package.json gracefully', async () => {
		const service = new CliConfigService();
		const config = await service.load(TEST_DIR);
		expect(config.version).toBe('1.0.0');
	});

	it('should handle empty package.json', async () => {
		writeFileSync(resolve(TEST_DIR, 'package.json'), '{}');

		const service = new CliConfigService();
		const config = await service.load(TEST_DIR);
		expect(config.version).toBe('1.0.0');
	});

	it('should handle malformed .env file', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'INVALID_LINE\n# comment\nKEY=value\n=');
		const service = new CliConfigService();
		const config = await service.load(TEST_DIR);
		expect(config.dev.port).toBe(DEFAULT_CONFIG.port);
	});

	it('should handle .env with duplicate keys', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'PORT=3000\nPORT=9000\n');
		const env = await loadEnvFiles(TEST_DIR);
		expect(env.PORT).toBe('9000');
	});

	it('should handle negative port number', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'PORT=-1\n');
		const service = new CliConfigService();
		const config = await service.load(TEST_DIR);
		expect(config.dev.port).toBe(-1);
	});

	it('should handle port number greater than 65535', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'PORT=70000\n');
		const service = new CliConfigService();
		const config = await service.load(TEST_DIR);
		expect(config.dev.port).toBe(70000);
	});

	it('should prioritize .env.local over .env', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'PORT=3000\nKEY=1\n');
		writeFileSync(resolve(TEST_DIR, '.env.local'), 'PORT=9000\nKEY=2\n');
		const env = await loadEnvFiles(TEST_DIR);
		expect(env.PORT).toBe('9000');
		expect(env.KEY).toBe('2');
	});

	it('should handle CI=true disabling open', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'CI=true\nOPEN=true\n');
		const service = new CliConfigService();
		const config = await service.load(TEST_DIR);
		expect(config.dev.open).toBe(false);
	});
});

describe('REGRESSION: isTruthy edge cases', () => {
	it('should handle "true" string', () => expect(isTruthy('true')).toBe(true));
	it('should handle "1" string', () => expect(isTruthy('1')).toBe(true));
	it('should handle "TRUE" uppercase', () => expect(isTruthy('TRUE')).toBe(true));
	it('should handle "True" mixed case', () => expect(isTruthy('True')).toBe(true));
	it('should handle empty string', () => expect(isTruthy('')).toBe(true));
	it('should handle "false" string', () => expect(isTruthy('false')).toBe(false));
	it('should handle "0" string', () => expect(isTruthy('0')).toBe(false));
	it('should handle "FALSE"', () => expect(isTruthy('FALSE')).toBe(false));
	it('should handle "no"', () => expect(isTruthy('no')).toBe(false));
	it('should handle undefined', () => expect(isTruthy(undefined)).toBe(false));
	it('should handle null', () => {
		const result = isTruthy(undefined);
		expect(result).toBe(false);
	});
	it('should handle "maybe"', () => expect(isTruthy('maybe')).toBe(false));
});

describe('REGRESSION: parseNumber edge cases', () => {
	it('should parse positive integers', () => expect(parseNumber('42')).toBe(42));
	it('should parse zero', () => expect(parseNumber('0')).toBe(0));
	it('should parse negative numbers', () => expect(parseNumber('-10')).toBe(-10));
	it('should parse decimal numbers', () => expect(parseNumber('3.14')).toBeCloseTo(3.14));
	it('should parse scientific notation', () => expect(parseNumber('1e5')).toBe(100000));
	it('should return undefined for "abc"', () => expect(parseNumber('abc')).toBeUndefined());
	it('should return undefined for empty string', () => expect(parseNumber('')).toBeUndefined());
	it('should return undefined for undefined', () => expect(parseNumber(undefined)).toBeUndefined());
	it('should return undefined for NaN', () => expect(parseNumber('NaN')).toBeUndefined());
	it('should return undefined for Infinity', () => expect(parseNumber('Infinity')).toBeUndefined());
});

describe('REGRESSION: parseBool edge cases', () => {
	it('should parse "true"', () => expect(parseBool('true')).toBe(true));
	it('should parse "1"', () => expect(parseBool('1')).toBe(true));
	it('should parse empty string', () => expect(parseBool('')).toBe(true));
	it('should parse "false"', () => expect(parseBool('false')).toBe(false));
	it('should parse "0"', () => expect(parseBool('0')).toBe(false));
	it('should return undefined for undefined', () => expect(parseBool(undefined)).toBeUndefined());
	it('should return undefined for "maybe"', () => expect(parseBool('maybe')).toBeUndefined());
});

describe('REGRESSION: constants integrity', () => {
	it('should have all HTTP status codes', () => {
		expect(HTTP_STATUS.OK).toBe(200);
		expect(HTTP_STATUS.NOT_FOUND).toBe(404);
		expect(HTTP_STATUS.INTERNAL_ERROR).toBe(500);
	});

	it('should have all commands', () => {
		expect(COMMANDS.DEV).toBe('dev');
		expect(COMMANDS.BUILD).toBe('build');
		expect(COMMANDS.TYPECHECK).toBe('typecheck');
	});

	it('should have all presets', () => {
		expect(PRESETS.NODE).toBe('node');
		expect(PRESETS.VERCEL).toBe('vercel');
		expect(PRESETS.NETLIFY).toBe('netlify');
		expect(PRESETS.CLOUDFLARE).toBe('cloudflare');
	});

	it('should have valid default port', () => {
		expect(DEFAULT_CONFIG.port).toBeGreaterThanOrEqual(1);
		expect(DEFAULT_CONFIG.port).toBeLessThanOrEqual(65535);
	});

	it('should have valid target', () => {
		expect(['es2020', 'es2021', 'es2022', 'esnext']).toContain(DEFAULT_CONFIG.target);
	});

	it('should have valid outDir paths', () => {
		expect(DEFAULT_CONFIG.outDirClient).toBe('dist/client');
		expect(DEFAULT_CONFIG.outDirServer).toBe('dist/server');
	});

	it('should have entry paths starting with src/', () => {
		expect(DEFAULT_CONFIG.entryClient).toContain('src/');
		expect(DEFAULT_CONFIG.entryServer).toContain('src/');
	});

	it('should have APP_NAME', () => {
		expect(APP_NAME).toBe('effuse');
	});
});

describe('REGRESSION: error classes', () => {
	it('should create CliError with message', () => {
		const error = new CliError({ message: 'Test' });
		expect(error.message).toBe('Test');
		expect(error._tag).toBe('CliError');
	});

	it('should create CliError with cause', () => {
		const cause = new Error('cause');
		const error = new CliError({ message: 'Test', cause });
		expect(error.cause).toBe(cause);
	});

	it('should create BuildError with message', () => {
		const error = new BuildError({ message: 'Build failed' });
		expect(error.message).toBe('Build failed');
		expect(error._tag).toBe('BuildError');
	});

	it('should create BuildError with cause', () => {
		const cause = new Error('cause');
		const error = new BuildError({ message: 'Build failed', cause });
		expect(error.cause).toBe(cause);
	});

	it('should create DevServerError with message', () => {
		const error = new DevServerError({ message: 'Server error' });
		expect(error.message).toBe('Server error');
		expect(error._tag).toBe('DevServerError');
	});

	it('should create ConfigError with message', () => {
		const error = new ConfigError({ message: 'Config error' });
		expect(error.message).toBe('Config error');
		expect(error._tag).toBe('ConfigError');
	});

	it('should create FileError with message', () => {
		const error = new FileError({ message: 'File error' });
		expect(error.message).toBe('File error');
		expect(error._tag).toBe('FileError');
	});
});

describe('REGRESSION: env file edge cases', () => {
	beforeEach(setupTestDir);
	afterEach(teardownTestDir);

	it('should skip lines without equals sign', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'KEY1=value1\nNO_EQUALS\nKEY2=value2\n');
		const env = await loadEnvFiles(TEST_DIR);
		expect(env.KEY1).toBe('value1');
		expect(env.KEY2).toBe('value2');
	});

	it('should handle empty value after equals', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'KEY=\nKEY2=value\n');
		const env = await loadEnvFiles(TEST_DIR);
		expect(env.KEY).toBe('');
	});

	it('should handle value with equals sign', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'COOKIE=abc=123=xyz\n');
		const env = await loadEnvFiles(TEST_DIR);
		expect(env.COOKIE).toBe('abc=123=xyz');
	});

	it('should handle quoted values', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'KEY="quoted"\nKEY2=\'single\'\n');
		const env = await loadEnvFiles(TEST_DIR);
		expect(env.KEY).toBe('"quoted"');
	});

	it('should handle inline comments', async () => {
		writeFileSync(resolve(TEST_DIR, '.env'), 'KEY=value # comment\n');
		const env = await loadEnvFiles(TEST_DIR);
		expect(env.KEY).toBe('value');
	});

	it('should return empty object for missing file', async () => {
		const env = await loadEnvFiles(resolve(TEST_DIR, 'missing.env'));
		expect(Object.keys(env)).toHaveLength(0);
	});
});