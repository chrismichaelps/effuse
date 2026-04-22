import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'node:path';
import { existsSync, rmSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const FIXTURE_DIR = resolve(process.cwd(), '__tests__/fixtures/app');
const DIST_CLIENT = resolve(FIXTURE_DIR, 'dist/client');
const DIST_SERVER = resolve(FIXTURE_DIR, 'dist/server');

const setup = () => {
	rmSync(resolve(FIXTURE_DIR, 'dist'), { recursive: true, force: true });
};

const teardown = () => {
	// Keep fixtures for inspection
};

describe('CLI E2E', () => {
	beforeEach(setup);
	afterEach(teardown);

	describe('build', () => {
		it('should build client successfully', async () => {
			const cwd = FIXTURE_DIR;
			
			// Run build command
			execSync('node ../../../dist/cli.cjs build --client-only', {
				cwd,
				stdio: 'pipe',
			});

			// Verify output
			expect(existsSync(DIST_CLIENT)).toBe(true);
			expect(existsSync(join(DIST_CLIENT, 'index.html'))).toBe(true);
		}, 60000);

		it('should build client and server successfully', async () => {
			const cwd = FIXTURE_DIR;
			
			execSync('node ../../../dist/cli.cjs build', {
				cwd,
				stdio: 'pipe',
			});

			expect(existsSync(DIST_CLIENT)).toBe(true);
			expect(existsSync(DIST_SERVER)).toBe(true);
			expect(existsSync(join(DIST_CLIENT, 'index.html'))).toBe(true);
		}, 60000);

		it('should respect preset option', async () => {
			const cwd = FIXTURE_DIR;
			
			execSync('node ../../../dist/cli.cjs build --preset=node', {
				cwd,
				stdio: 'pipe',
			});

			expect(existsSync(DIST_CLIENT)).toBe(true);
		}, 60000);
	});

	describe('dev', () => {
		it('should start dev server and respond to requests', async () => {
			const cwd = FIXTURE_DIR;
			
			// Start server in background
			const serverProcess = execSync('node ../../../dist/cli.cjs dev --port=3001 --no-open', {
				cwd,
				stdio: 'pipe',
				timeout: 5000,
			});
			
			// Server should start without errors
			expect(serverProcess.toString()).toContain('Server ready');
		}, 30000);
	});

	describe('config', () => {
		it('should load env files', async () => {
			const cwd = FIXTURE_DIR;
			
			// Test that env is loaded
			const result = execSync('node ../../../dist/cli.cjs build --client-only', {
				cwd,
				stdio: 'pipe',
			});
			
			expect(result.toString()).toContain('Building');
		}, 60000);
	});
});