/**
 * Node.js built-in test runner for CLI arg parser.
 * Run with: node --test src/__tests__/node/args.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

const parseOptionValue = (value) => {
	if (value === 'true') return true;
	if (value === 'false') return false;
	const num = Number(value);
	if (!isNaN(num) && String(num) === value) return num;
	return value;
};

const parseArgs = (argv) => {
	const options = {};
	const positional = [];
	let i = 0;

	while (i < argv.length) {
		const arg = argv[i];

		if (arg === '--') {
			positional.push(...argv.slice(i + 1));
			break;
		}

		if (arg.startsWith('--')) {
			const eqIdx = arg.indexOf('=');
			if (eqIdx !== -1) {
				const key = arg.slice(2, eqIdx).replace(/-/g, '_');
				const value = arg.slice(eqIdx + 1);
				options[key] = parseOptionValue(value);
			} else if (arg.startsWith('--no-')) {
				const key = arg.slice(5).replace(/-/g, '_');
				options[key] = false;
			} else {
				const key = arg.slice(2).replace(/-/g, '_');
				const next = argv[i + 1];
				if (next && !next.startsWith('-')) {
					options[key] = parseOptionValue(next);
					i++;
				} else {
					options[key] = true;
				}
			}
		} else if (arg.startsWith('-') && arg.length > 1) {
			const key = arg.slice(1);
			const next = argv[i + 1];
			if (next && !next.startsWith('-')) {
				options[key] = parseOptionValue(next);
				i++;
			} else {
				options[key] = true;
			}
		} else {
			positional.push(arg);
		}
		i++;
	}

	return {
		command: positional[0] ?? null,
		options,
		args: positional.slice(1),
	};
};

describe('parseArgs', () => {
	it('should parse command', () => {
		const result = parseArgs(['build']);
		assert.strictEqual(result.command, 'build');
		assert.deepStrictEqual(result.args, []);
	});

	it('should parse options with values', () => {
		const result = parseArgs(['dev', '--port', '3000']);
		assert.strictEqual(result.options.port, 3000);
	});

	it('should parse options with equals', () => {
		const result = parseArgs(['build', '--preset=vercel']);
		assert.strictEqual(result.options.preset, 'vercel');
	});

	it('should parse boolean flags', () => {
		const result = parseArgs(['build', '--analyze']);
		assert.strictEqual(result.options.analyze, true);
	});

	it('should parse negated flags', () => {
		const result = parseArgs(['dev', '--no-open']);
		assert.strictEqual(result.options.open, false);
	});

	it('should parse short flags', () => {
		const result = parseArgs(['dev', '-p', '8080']);
		assert.strictEqual(result.options.p, 8080);
	});

	it('should parse multiple options', () => {
		const result = parseArgs(['dev', '--port', '3000', '--host', '0.0.0.0']);
		assert.strictEqual(result.options.port, 3000);
		assert.strictEqual(result.options.host, '0.0.0.0');
	});

	it('should parse positional args after command', () => {
		const result = parseArgs(['build', 'extra', '--preset', 'vercel']);
		assert.deepStrictEqual(result.args, ['extra']);
	});

	it('should handle empty args', () => {
		const result = parseArgs([]);
		assert.strictEqual(result.command, null);
		assert.deepStrictEqual(result.options, {});
	});

	it('should handle -- separator', () => {
		const result = parseArgs(['dev', '--', '--port', '3000']);
		assert.deepStrictEqual(result.args, ['--port', '3000']);
	});

	it('should parse host with short flag', () => {
		const result = parseArgs(['dev', '-h', 'localhost']);
		assert.strictEqual(result.options.h, 'localhost');
	});

	it('should parse https flag', () => {
		const result = parseArgs(['dev', '--https']);
		assert.strictEqual(result.options.https, true);
	});

	it('should parse client-only flag', () => {
		const result = parseArgs(['build', '--client-only']);
		assert.strictEqual(result.options.client_only, true);
	});

	it('should parse verbose flag', () => {
		const result = parseArgs(['build', '--verbose']);
		assert.strictEqual(result.options.verbose, true);
	});

	it('should parse quiet flag', () => {
		const result = parseArgs(['build', '--quiet']);
		assert.strictEqual(result.options.quiet, true);
	});
});