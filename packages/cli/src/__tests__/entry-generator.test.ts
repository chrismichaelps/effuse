/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	mkdtempSync,
	writeFileSync,
	rmSync,
	existsSync,
	readFileSync,
	mkdirSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { EntryGenerator } from '../services/entry-generator.js';

describe('EntryGenerator', () => {
	let tempDir: string;
	let generator: EntryGenerator;

	beforeEach(() => {
		tempDir = mkdtempSync(resolve(tmpdir(), 'effuse-entry-test-'));
		generator = new EntryGenerator();
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('should use user entries when both exist', () => {
		mkdirSync(resolve(tempDir, 'src'), { recursive: true });
		writeFileSync(resolve(tempDir, 'src/entry-client.ts'), '', 'utf-8');
		writeFileSync(resolve(tempDir, 'src/entry-server.ts'), '', 'utf-8');

		const result = generator.generate(tempDir);

		expect(result.generated).toBe(false);
		expect(result.client).toBe('src/entry-client.ts');
		expect(result.server).toBe('src/entry-server.ts');
	});

	it('should auto-generate entries when app.ts exists but no user entries', () => {
		mkdirSync(resolve(tempDir, 'src'), { recursive: true });
		writeFileSync(
			resolve(tempDir, 'src/app.ts'),
			'export const app = {};',
			'utf-8'
		);

		const result = generator.generate(tempDir);

		expect(result.generated).toBe(true);
		expect(result.client).toBe('.effuse/entry-client.ts');
		expect(result.server).toBe('.effuse/entry-server.ts');

		const clientContent = readFileSync(
			resolve(tempDir, '.effuse/entry-client.ts'),
			'utf-8'
		);
		expect(clientContent).toContain("import { app } from '../src/app.ts'");
		expect(clientContent).toContain("await app.mount('#app')");

		const serverContent = readFileSync(
			resolve(tempDir, '.effuse/entry-server.ts'),
			'utf-8'
		);
		expect(serverContent).toContain("import { app } from '../src/app.ts'");
		expect(serverContent).toContain(
			"import type { AssetManifest } from '@effuse/core'"
		);
		expect(serverContent).toContain('export async function handleRequest');
		expect(serverContent).toContain('app.handleRequest');
		expect(serverContent).toContain('manifest');
	});

	it('should only generate missing entries when one exists', () => {
		mkdirSync(resolve(tempDir, 'src'), { recursive: true });
		writeFileSync(
			resolve(tempDir, 'src/app.ts'),
			'export const app = {};',
			'utf-8'
		);
		writeFileSync(resolve(tempDir, 'src/entry-client.ts'), '', 'utf-8');

		const result = generator.generate(tempDir);

		expect(result.generated).toBe(true);
		expect(result.client).toBe('src/entry-client.ts');
		expect(result.server).toBe('.effuse/entry-server.ts');

		expect(existsSync(resolve(tempDir, '.effuse/entry-client.ts'))).toBe(false);
		expect(existsSync(resolve(tempDir, '.effuse/entry-server.ts'))).toBe(true);
	});

	it('should not generate anything when app.ts is missing', () => {
		const result = generator.generate(tempDir);

		expect(result.generated).toBe(false);
		expect(existsSync(resolve(tempDir, '.effuse'))).toBe(false);
	});

	describe('generateServerBootstrap', () => {
		it('should bind createNodeServer and wire graceful shutdown for node', () => {
			const bootstrap = generator.generateServerBootstrap(
				tempDir,
				'.effuse/entry-server.ts',
				'node'
			);

			expect(bootstrap).toBe('.effuse/entry-node.ts');
			const content = readFileSync(resolve(tempDir, bootstrap), 'utf-8');

			expect(content).toContain(
				"import { createNodeServer, withStaticFiles } from '@effuse/server/node'"
			);
			expect(content).toContain(
				"import { handleRequest } from './entry-server.ts'"
			);
			expect(content).toContain(
				"const clientRoot = new URL('../client/', import.meta.url)"
			);
			expect(content).toContain(
				'createNodeServer(withStaticFiles(handleRequest, { root: clientRoot }))'
			);
			expect(content).toContain('server.listen({ port, host })');
			expect(content).toContain('server\n\t\t.close()');
			expect(content).toContain("process.on('SIGTERM'");
			expect(content).toContain("process.on('SIGINT'");
		});

		it('should bind createBunServer for the bun runtime', () => {
			const bootstrap = generator.generateServerBootstrap(
				tempDir,
				'.effuse/entry-server.ts',
				'bun'
			);

			expect(bootstrap).toBe('.effuse/entry-bun.ts');
			const content = readFileSync(resolve(tempDir, bootstrap), 'utf-8');

			expect(content).toContain(
				"import { createBunServer, withStaticFiles } from '@effuse/server/bun'"
			);
			expect(content).toContain(
				'createBunServer(withStaticFiles(handleRequest, { root: clientRoot }))'
			);
		});

		it('should compute a relative import for a user server entry', () => {
			const bootstrap = generator.generateServerBootstrap(
				tempDir,
				'src/entry-server.ts',
				'node'
			);

			const content = readFileSync(resolve(tempDir, bootstrap), 'utf-8');
			expect(content).toContain(
				"import { handleRequest } from '../src/entry-server.ts'"
			);
		});
	});
});
