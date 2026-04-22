/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ManifestResolver } from '../services/manifest.js';

describe('ManifestResolver', () => {
	let tempDir: string;
	let resolver: ManifestResolver;

	beforeEach(() => {
		tempDir = mkdtempSync(resolve(tmpdir(), 'effuse-manifest-test-'));
		resolver = new ManifestResolver();
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('should return null when manifest.json does not exist', () => {
		const result = resolver.resolve(tempDir);
		expect(result).toBeNull();
	});

	it('should parse and return a valid Vite manifest', () => {
		mkdirSync(resolve(tempDir, 'dist/client'), { recursive: true });
		const manifest = {
			'src/main.ts': {
				file: 'assets/main-abc123.js',
				isEntry: true,
				css: ['assets/main-abc123.css'],
			},
			'chunk-vendor': {
				file: 'assets/vendor-def456.js',
			},
		};
		writeFileSync(
			resolve(tempDir, 'dist/client/manifest.json'),
			JSON.stringify(manifest),
			'utf-8'
		);

		const result = resolver.resolve(tempDir);
		expect(result).not.toBeNull();
		expect(result).toHaveProperty('src/main.ts');
		expect(result!['src/main.ts'].file).toBe('assets/main-abc123.js');
		expect(result!['src/main.ts'].css).toEqual(['assets/main-abc123.css']);
	});

	it('should return null for invalid JSON', () => {
		mkdirSync(resolve(tempDir, 'dist/client'), { recursive: true });
		writeFileSync(resolve(tempDir, 'dist/client/manifest.json'), 'not json', 'utf-8');

		const result = resolver.resolve(tempDir);
		expect(result).toBeNull();
	});

	it('should return null for malformed manifest structure', () => {
		mkdirSync(resolve(tempDir, 'dist/client'), { recursive: true });
		writeFileSync(
			resolve(tempDir, 'dist/client/manifest.json'),
			JSON.stringify({ 'src/main.ts': { src: 'main.ts' } }),
			'utf-8'
		);

		const result = resolver.resolve(tempDir);
		expect(result).toBeNull();
	});

	it('should serialize manifest back to JSON', () => {
		const manifest = {
			entry: { file: 'entry.js', isEntry: true },
		};
		const serialized = resolver.serialize(manifest);
		expect(JSON.parse(serialized)).toEqual(manifest);
	});
});
