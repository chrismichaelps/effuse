import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { CliConfigService } from '../../src/config/index.js';
import { APP_NAME, DEFAULT_CONFIG, ENV_KEYS, PRESETS, COMMANDS } from '../../src/constants.js';
import { CliError, BuildError, DevServerError } from '../../src/errors/index.js';
import {
	loadEnvFiles,
	readEnvFile,
	isTruthy,
	parseNumber,
	parseBool,
	fileExists,
} from '../../src/utils/index.js';

const TEST_DIR = resolve(process.cwd(), '.test-tmp');

const setupTestDir = () => {
	rmSync(TEST_DIR, { recursive: true, force: true });
	mkdirSync(TEST_DIR, { recursive: true });
};

const teardownTestDir = () => {
	rmSync(TEST_DIR, { recursive: true, force: true });
};

describe('CliConfigService', () => {
	beforeEach(setupTestDir);
	afterEach(teardownTestDir);

	describe('load', () => {
		it('should load default config when no env files exist', async () => {
			writeFileSync(resolve(TEST_DIR, 'package.json'), JSON.stringify({ version: '2.0.0' }));

			const service = new CliConfigService();
			const config = await service.load(TEST_DIR);

			expect(config.version).toBe('2.0.0');
			expect(config.dev.port).toBe(DEFAULT_CONFIG.port);
			expect(config.dev.host).toBe(DEFAULT_CONFIG.host);
			expect(config.dev.open).toBe(DEFAULT_CONFIG.open);
			expect(config.build.minify).toBe(DEFAULT_CONFIG.minify);
		});

		it('should read version from package.json', async () => {
			writeFileSync(resolve(TEST_DIR, 'package.json'), JSON.stringify({ version: '3.0.0' }));

			const service = new CliConfigService();
			const config = await service.load(TEST_DIR);

			expect(config.version).toBe('3.0.0');
		});

		it('should fall back to 1.0.0 when package.json is missing', async () => {
			const service = new CliConfigService();
			const config = await service.load(TEST_DIR);

			expect(config.version).toBe('1.0.0');
		});

		it('should override defaults from .env file', async () => {
			writeFileSync(resolve(TEST_DIR, 'package.json'), JSON.stringify({ version: '1.0.0' }));
			writeFileSync(resolve(TEST_DIR, '.env'), [
				'PORT=8080',
				'HOST=0.0.0.0',
				'MINIFY=false',
			].join('\n'));

			const service = new CliConfigService();
			const config = await service.load(TEST_DIR);

			expect(config.dev.port).toBe(8080);
			expect(config.dev.host).toBe('0.0.0.0');
			expect(config.build.minify).toBe(false);
		});

		it('should prioritize .env.local over .env', async () => {
			writeFileSync(resolve(TEST_DIR, 'package.json'), JSON.stringify({ version: '1.0.0' }));
			writeFileSync(resolve(TEST_DIR, '.env'), 'PORT=3000\n');
			writeFileSync(resolve(TEST_DIR, '.env.local'), 'PORT=9000\n');

			const service = new CliConfigService();
			const config = await service.load(TEST_DIR);

			expect(config.dev.port).toBe(9000);
		});
	});
});

describe('constants', () => {
	it('should export APP_NAME as effuse', () => {
		expect(APP_NAME).toBe('effuse');
	});

	it('should have all required commands', () => {
		expect(COMMANDS.DEV).toBe('dev');
		expect(COMMANDS.BUILD).toBe('build');
		expect(COMMANDS.TYPECHECK).toBe('typecheck');
	});

	it('should have all preset values', () => {
		expect(PRESETS.NODE).toBe('node');
		expect(PRESETS.VERCEL).toBe('vercel');
		expect(PRESETS.NETLIFY).toBe('netlify');
		expect(PRESETS.CLOUDFLARE).toBe('cloudflare');
	});

	it('should have default port in range', () => {
		expect(DEFAULT_CONFIG.port).toBeGreaterThanOrEqual(1);
		expect(DEFAULT_CONFIG.port).toBeLessThanOrEqual(65535);
	});

	it('should have valid target values', () => {
		expect(['es2020', 'es2021', 'es2022', 'esnext']).toContain(DEFAULT_CONFIG.target);
	});

	it('should have all required env keys', () => {
		expect(ENV_KEYS.DESKTOP_PORT).toBeDefined();
		expect(ENV_KEYS.DESKTOP_HOST).toBeDefined();
		expect(ENV_KEYS.CI).toBeDefined();
	});
});

describe('utils', () => {
	beforeEach(setupTestDir);
	afterEach(teardownTestDir);

	describe('isTruthy', () => {
		it('should return true for true strings', () => {
			expect(isTruthy('true')).toBe(true);
		});

		it('should return true for 1', () => {
			expect(isTruthy('1')).toBe(true);
		});

		it('should return true for empty string', () => {
			expect(isTruthy('')).toBe(true);
		});

		it('should return false for false strings', () => {
			expect(isTruthy('false')).toBe(false);
		});

		it('should return false for 0', () => {
			expect(isTruthy('0')).toBe(false);
		});

		it('should return false for undefined', () => {
			expect(isTruthy(undefined)).toBe(false);
		});
	});

	describe('parseNumber', () => {
		it('should parse valid numbers', () => {
			expect(parseNumber('42')).toBe(42);
			expect(parseNumber('0')).toBe(0);
			expect(parseNumber('-10')).toBe(-10);
		});

		it('should return undefined for invalid numbers', () => {
			expect(parseNumber('abc')).toBeUndefined();
			expect(parseNumber('')).toBeUndefined();
		});

		it('should return undefined for undefined input', () => {
			expect(parseNumber(undefined)).toBeUndefined();
		});
	});

	describe('parseBool', () => {
		it('should parse truthy values', () => {
			expect(parseBool('true')).toBe(true);
			expect(parseBool('1')).toBe(true);
		});

		it('should return false for explicit falsy values', () => {
			expect(parseBool('false')).toBe(false);
			expect(parseBool('0')).toBe(false);
		});

		it('should return undefined for empty or invalid input', () => {
			expect(parseBool(undefined)).toBeUndefined();
			expect(parseBool('')).toBeUndefined();
			expect(parseBool('maybe')).toBeUndefined();
		});
	});

	describe('fileExists', () => {
		it('should return true for existing file', async () => {
			writeFileSync(resolve(TEST_DIR, 'test.txt'), 'content');
			expect(await fileExists(resolve(TEST_DIR, 'test.txt'))).toBe(true);
		});

		it('should return false for non-existing file', async () => {
			expect(await fileExists(resolve(TEST_DIR, 'nonexistent.txt'))).toBe(false);
		});
	});

	describe('loadEnvFiles', () => {
		it('should load and merge .env and .env.local', async () => {
			writeFileSync(resolve(TEST_DIR, '.env'), 'BASE=1\nOVERRIDE=original\n');
			writeFileSync(resolve(TEST_DIR, '.env.local'), 'LOCAL=2\nOVERRIDE=overridden\n');

			const env = await loadEnvFiles(TEST_DIR);

			expect(env.BASE).toBe('1');
			expect(env.LOCAL).toBe('2');
			expect(env.OVERRIDE).toBe('overridden');
		});

		it('should return empty object when no env files exist', async () => {
			const env = await loadEnvFiles(TEST_DIR);
			expect(Object.keys(env)).toHaveLength(0);
		});

		it('should skip comments and empty lines', async () => {
			writeFileSync(resolve(TEST_DIR, '.env'), [
				'# comment',
				'',
				'KEY=value',
			].join('\n'));

			const env = await loadEnvFiles(TEST_DIR);
			expect(env.KEY).toBe('value');
			expect(env['# comment']).toBeUndefined();
		});
	});

	describe('readEnvFile', () => {
		it('should parse .env file correctly', async () => {
			writeFileSync(resolve(TEST_DIR, 'test.env'), [
				'KEY=value',
				'NUMBER=42',
				'EMPTY=',
			].join('\n'));

			const env = await readEnvFile(resolve(TEST_DIR, 'test.env'));

			expect(env.KEY).toBe('value');
			expect(env.NUMBER).toBe('42');
			expect(env.EMPTY).toBe('');
		});

		it('should return empty object for non-existing file', async () => {
			const env = await readEnvFile(resolve(TEST_DIR, 'nonexistent.env'));
			expect(Object.keys(env)).toHaveLength(0);
		});

		it('should handle values with equals signs', async () => {
			writeFileSync(resolve(TEST_DIR, 'test.env'), 'COOKIE=abc=123\n');
			const env = await readEnvFile(resolve(TEST_DIR, 'test.env'));
			expect(env.COOKIE).toBe('abc=123');
		});
	});
});

describe('errors', () => {
	describe('CliError', () => {
		it('should create error with message and cause', () => {
			const error = new CliError({ message: 'Test error', cause: new Error('original') });
			expect(error.message).toBe('Test error');
			expect(error.cause).toBeDefined();
		});

		it('should have correct _tag', () => {
			const error = new CliError({ message: 'Test' });
			expect(error._tag).toBe('CliError');
		});
	});

	describe('BuildError', () => {
		it('should create error with message', () => {
			const error = new BuildError({ message: 'Build failed' });
			expect(error.message).toBe('Build failed');
			expect(error._tag).toBe('BuildError');
		});
	});

	describe('DevServerError', () => {
		it('should create error with cause', () => {
			const error = new DevServerError({ message: 'Server error', cause: new Error('original') });
			expect(error.message).toBe('Server error');
			expect(error.cause).toBeDefined();
		});
	});
});

describe('integration', () => {
	beforeEach(setupTestDir);
	afterEach(teardownTestDir);

	describe('config with env override', () => {
		it('should apply CI mode correctly', async () => {
			writeFileSync(resolve(TEST_DIR, 'package.json'), JSON.stringify({ version: '1.0.0' }));
			writeFileSync(resolve(TEST_DIR, '.env'), 'CI=true\nOPEN=true\n');

			const service = new CliConfigService();
			const config = await service.load(TEST_DIR);

			expect(config.dev.open).toBe(false);
		});

		it('should handle preset override', async () => {
			writeFileSync(resolve(TEST_DIR, 'package.json'), JSON.stringify({ version: '1.0.0' }));
			writeFileSync(resolve(TEST_DIR, '.env'), '');

			const service = new CliConfigService();
			const config = await service.load(TEST_DIR);

			expect(typeof config.build.minify).toBe('boolean');
		});
	});
});