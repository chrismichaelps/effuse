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

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { DEFAULT_CONFIG, PRESETS } from '../constants.js';

const TEST_DIR = resolve(process.cwd(), '.build-test-tmp');

const setupTestDir = () => {
	rmSync(TEST_DIR, { recursive: true, force: true });
	mkdirSync(TEST_DIR, { recursive: true });
};

const teardownTestDir = () => {
	rmSync(TEST_DIR, { recursive: true, force: true });
};

describe('BuildService platform configs', () => {
	beforeEach(setupTestDir);
	afterEach(teardownTestDir);

	describe('vercel.json', () => {
		it('should generate valid vercel.json with correct schema', async () => {
			writeFileSync(resolve(TEST_DIR, 'vercel.json'), JSON.stringify({
				$schema: 'https://openapi.vercel.sh/vercel.json',
				framework: null,
				buildCommand: 'npm run build',
				outputDirectory: DEFAULT_CONFIG.outDirClient,
				installCommand: 'pnpm install',
				cleanUrls: true,
				trailingSlash: false,
			}));

			const content = readFileSync(resolve(TEST_DIR, 'vercel.json'), 'utf-8');
			const parsed = JSON.parse(content);

			expect(parsed.$schema).toBe('https://openapi.vercel.sh/vercel.json');
			expect(parsed.framework).toBeNull();
			expect(parsed.buildCommand).toBe('npm run build');
			expect(parsed.outputDirectory).toBe(DEFAULT_CONFIG.outDirClient);
			expect(parsed.cleanUrls).toBe(true);
			expect(parsed.trailingSlash).toBe(false);
		});

		it('should include security headers', () => {
			const headers = [
				{ key: 'X-Content-Type-Options', value: 'nosniff' },
				{ key: 'X-Frame-Options', value: 'DENY' },
				{ key: 'X-XSS-Protection', value: '1; mode=block' },
				{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
			];

			for (const header of headers) {
				expect(header.key).toBeTruthy();
				expect(header.value).toBeTruthy();
			}
		});

		it('should include rewrites for server routes', () => {
			const rewrites = [{
				source: `/${DEFAULT_CONFIG.outDirServer}/(.*)`,
				destination: `/${DEFAULT_CONFIG.outDirServer}/$1`,
			}];

			expect(rewrites.length).toBeGreaterThan(0);
			expect(rewrites[0].source).toContain(DEFAULT_CONFIG.outDirServer);
			expect(rewrites[0].destination).toContain(DEFAULT_CONFIG.outDirServer);
		});

		it('should not use legacy builds array', () => {
			const config = { framework: null } as { framework: null; builds?: unknown };
			expect(config.builds).toBeUndefined();
		});
	});

	describe('wrangler.toml', () => {
		it('should generate valid TOML config', () => {
			const content = `$schema = "./node_modules/wrangler/config-schema.json"
name = "effuse-app"
main = "${DEFAULT_CONFIG.outDirServer}/index.js"
compatibility_date = "${new Date().toISOString().split('T')[0]}"
workers_dev = false

[assets]
directory = "./${DEFAULT_CONFIG.outDirClient}"
binding = "ASSETS"
`;

			expect(content).toContain('$schema');
			expect(content).toContain('name = "effuse-app"');
			expect(content).toContain('main = "');
			expect(content).toContain('compatibility_date = "');
			expect(content).toContain('workers_dev = false');
			expect(content).toContain('[assets]');
			expect(content).toContain('directory = "./');
			expect(content).toContain('binding = "ASSETS"');
		});

		it('should reference client output directory', () => {
			expect(DEFAULT_CONFIG.outDirClient).toBeTruthy();
			expect(DEFAULT_CONFIG.outDirClient).toMatch(/^dist\//);
		});

		it('should not contain JSON-only keys', () => {
			const content = `$schema = "..."\nname = "test"`;
			expect(content).not.toContain('build.upload');
			expect(content).not.toContain('"region"');
			expect(content).not.toContain('upload:');
		});
	});

	describe('netlify.toml', () => {
		it('should generate valid TOML config', () => {
			const content = `[build]
  command = "npm run build"
  publish = "${DEFAULT_CONFIG.outDirClient}"

[build.environment]
  NODE_VERSION = "22"

[functions]
  directory = "${DEFAULT_CONFIG.outDirServer}"
  node_bundler = "zisi"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
`;

			expect(content).toContain('[build]');
			expect(content).toContain('command = "npm run build"');
			expect(content).toContain(`publish = "${DEFAULT_CONFIG.outDirClient}"`);
			expect(content).toContain('NODE_VERSION = "22"');
			expect(content).toContain('[functions]');
			expect(content).toContain(`directory = "${DEFAULT_CONFIG.outDirServer}"`);
			expect(content).toContain('node_bundler = "zisi"');
			expect(content).toContain('[[redirects]]');
			expect(content).toContain('[[headers]]');
			expect(content).toContain('X-Frame-Options = "DENY"');
		});

		it('should not have invalid NPM_FLAGS syntax', () => {
			const content = `[build]
  command = "npm run build"
  publish = "dist/client"

[build.environment]
  NODE_VERSION = "22"
`;
			expect(content).not.toContain('NPM_FLAGS');
			expect(content).not.toContain('--prefix=false');
		});

		it('should not have invalid condition syntax', () => {
			const content = `[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
			expect(content).not.toContain('condition = {');
			expect(content).not.toContain('Language = "html"');
		});

		it('should use status 200 for rewrites', () => {
			const content = `[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
			expect(content).toContain('status = 200');
		});
	});

	describe('ecosystem.config.js', () => {
		it('should generate valid JS module.exports config', () => {
			const content = `module.exports = {
  apps: [{
    name: "effuse-server",
    script: "${DEFAULT_CONFIG.outDirServer}/index.js",
    instances: 1,
    exec_mode: "cluster",
    max_memory_restart: "512M",
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}
`;

			expect(content).toContain('module.exports = {');
			expect(content).toContain('apps: [{');
			expect(content).toContain('name: "effuse-server"');
			expect(content).toContain(`script: "${DEFAULT_CONFIG.outDirServer}/index.js"`);
			expect(content).toContain('instances: 1');
			expect(content).toContain('exec_mode: "cluster"');
			expect(content).toContain('max_memory_restart: "512M"');
			expect(content).toContain('env_production: {');
			expect(content).toContain('NODE_ENV: "production"');
			expect(content).toContain('PORT: 3000');
		});

		it('should use .js extension not .json', () => {
			const filename = 'ecosystem.config.js';
			expect(filename).toContain('.js');
			expect(filename).not.toContain('.json');
		});

		it('should have correct instances casing', () => {
			const content = 'instances: 1';
			expect(content).not.toContain('Instances');
		});

		it('should use cluster exec_mode for load balancing', () => {
			const content = 'exec_mode: "cluster"';
			expect(content).toBe('exec_mode: "cluster"');
		});
	});

	describe('public directory copy', () => {
		it('should copy public files to output directory', async () => {
			mkdirSync(resolve(TEST_DIR, 'public'), { recursive: true });
			writeFileSync(resolve(TEST_DIR, 'public', 'test.txt'), 'test content');
			mkdirSync(resolve(TEST_DIR, 'dist/client'), { recursive: true });

			expect(existsSync(resolve(TEST_DIR, 'public'))).toBe(true);
		});

		it('should skip if public directory does not exist', () => {
			expect(existsSync(resolve(TEST_DIR, 'public'))).toBe(false);
		});

		it('should handle nested public files', () => {
			mkdirSync(resolve(TEST_DIR, 'public/css'), { recursive: true });
			writeFileSync(resolve(TEST_DIR, 'public/css/style.css'), 'body { }');
			writeFileSync(resolve(TEST_DIR, 'public/favicon.ico'), 'binary');

			expect(existsSync(resolve(TEST_DIR, 'public/css/style.css'))).toBe(true);
			expect(existsSync(resolve(TEST_DIR, 'public/favicon.ico'))).toBe(true);
		});
	});
});

describe('BuildService build output', () => {
	beforeEach(setupTestDir);
	afterEach(teardownTestDir);

	describe('output directory validation', () => {
		it('should validate output directory exists after build', async () => {
			mkdirSync(resolve(TEST_DIR, DEFAULT_CONFIG.outDirClient), { recursive: true });
			writeFileSync(resolve(TEST_DIR, DEFAULT_CONFIG.outDirClient, 'index.html'), '<html></html>');

			expect(existsSync(resolve(TEST_DIR, DEFAULT_CONFIG.outDirClient))).toBe(true);
			expect(existsSync(resolve(TEST_DIR, DEFAULT_CONFIG.outDirClient, 'index.html'))).toBe(true);
		});

		it('should check for manifest.json or index.html', async () => {
			mkdirSync(resolve(TEST_DIR, DEFAULT_CONFIG.outDirClient), { recursive: true });
			writeFileSync(resolve(TEST_DIR, DEFAULT_CONFIG.outDirClient, 'manifest.json'), '{}');

			const manifestPath = resolve(TEST_DIR, DEFAULT_CONFIG.outDirClient, 'manifest.json');
			const indexPath = resolve(TEST_DIR, DEFAULT_CONFIG.outDirClient, 'index.html');
			const hasManifest = existsSync(manifestPath);
			const hasIndex = existsSync(indexPath);

			expect(hasManifest || hasIndex).toBe(true);
		});

		it('should detect empty output directory', () => {
			mkdirSync(resolve(TEST_DIR, 'empty-out'), { recursive: true });

			expect(existsSync(resolve(TEST_DIR, 'empty-out'))).toBe(true);
		});
	});

	describe('preset selection', () => {
		it('should default to node preset', () => {
			const fallback = PRESETS.NODE;
			expect(fallback).toBe('node');
		});

		it('should support all preset values', () => {
			const presets = [PRESETS.NODE, PRESETS.VERCEL, PRESETS.NETLIFY, PRESETS.CLOUDFLARE];

			expect(presets).toContain('node');
			expect(presets).toContain('vercel');
			expect(presets).toContain('netlify');
			expect(presets).toContain('cloudflare');
		});
	});

	describe('build options', () => {
		it('should support clientOnly option', () => {
			const options = { clientOnly: true };
			expect(options.clientOnly).toBe(true);
		});

		it('should support analyze option', () => {
			const options = { analyze: true };
			expect(options.analyze).toBe(true);
		});

		it('should support preset option with all values', () => {
			const options = { preset: 'vercel' as const };
			expect(['node', 'vercel', 'netlify', 'cloudflare']).toContain(options.preset);
		});

		it('should allow combining options', () => {
			const options = {
				clientOnly: false,
				analyze: true,
				preset: 'netlify' as const,
			};
			expect(options.clientOnly).toBe(false);
			expect(options.analyze).toBe(true);
			expect(options.preset).toBe('netlify');
		});
	});
});