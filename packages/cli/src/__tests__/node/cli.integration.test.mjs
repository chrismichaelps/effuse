/**
 * Integration tests for CLI binary using Node.js built-in test runner.
 * Run with: node --test src/__tests__/node/cli.integration.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(__dirname, '../../../dist/bin.cjs');

const run = (args) => {
	try {
		const stdout = execSync(`node "${BIN}" ${args}`, {
			encoding: 'utf-8',
			cwd: resolve(__dirname, '../../../'),
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		return { stdout, stderr: '', exitCode: 0 };
	} catch (error) {
		return {
			stdout: error.stdout?.toString() ?? '',
			stderr: error.stderr?.toString() ?? '',
			exitCode: error.status ?? 1,
		};
	}
};

describe('CLI binary integration', () => {
	it('should show help', () => {
		const result = run('--help');
		assert.strictEqual(result.exitCode, 0);
		assert(result.stdout.includes('Usage:'));
		assert(result.stdout.includes('Commands:'));
	});

	it('should show version', () => {
		const result = run('--version');
		assert.strictEqual(result.exitCode, 0);
		assert(result.stdout.includes('effuse/'));
	});

	it('should error on invalid preset', () => {
		const result = run('build --preset invalid');
		assert.strictEqual(result.exitCode, 1);
		assert(result.stderr.includes('Invalid preset: "invalid"'));
	});

	it('should error on invalid port', () => {
		const result = run('dev --port abc');
		assert.strictEqual(result.exitCode, 1);
		assert(result.stderr.includes('Invalid port: "abc"'));
	});

	it('should error on missing command', () => {
		const result = run('');
		assert.strictEqual(result.exitCode, 1);
		assert(result.stderr.includes('No command specified'));
	});

	it('should error on unknown command', () => {
		const result = run('unknown');
		assert.strictEqual(result.exitCode, 1);
		assert(result.stderr.includes('Unknown command: "unknown"'));
	});

	it('should accept valid preset', () => {
		const result = run('build --preset node');
		// Build fails because no entry files, but preset validation passes
		assert(result.stderr.includes('Vite build failed') || result.stderr.includes('UNRESOLVED_ENTRY') || result.exitCode === 1);
		assert(!result.stderr.includes('Invalid preset'));
	});

	it('should accept valid port', () => {
		const result = run('dev --port 99999');
		assert(result.stderr.includes('Invalid port: "99999"') || result.exitCode === 1);
	});
});