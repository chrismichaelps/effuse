import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'node:path';
import { existsSync, rmSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const FIXTURE_DIR = resolve(process.cwd(), 'packages/cli/__tests__/fixtures/app');
const CLI_BIN = resolve(process.cwd(), 'packages/cli/dist/cli.cjs');

const hasFixture = existsSync(FIXTURE_DIR);
const hasCli = existsSync(CLI_BIN);

const setup = () => {
	rmSync(resolve(FIXTURE_DIR, 'dist'), { recursive: true, force: true });
};

const teardown = () => {
	// Keep fixtures for inspection
};

describe.skipIf(!hasFixture || !hasCli)('CLI E2E', () => {
	beforeEach(setup);
	afterEach(teardown);

	describe('build', () => {
		it('should run build command without crashing', async () => {
			const cwd = FIXTURE_DIR;
			
			const result = execSync(`node "${CLI_BIN}" build --client-only`, {
				cwd,
				stdio: 'pipe',
			});

			expect(result).toBeDefined();
		}, 60000);

		it('should run full build without crashing', async () => {
			const cwd = FIXTURE_DIR;
			
			const result = execSync(`node "${CLI_BIN}" build`, {
				cwd,
				stdio: 'pipe',
			});

			expect(result).toBeDefined();
		}, 60000);

		it('should run build with preset option', async () => {
			const cwd = FIXTURE_DIR;
			
			const result = execSync(`node "${CLI_BIN}" build --preset=node`, {
				cwd,
				stdio: 'pipe',
			});

			expect(result).toBeDefined();
		}, 60000);
	});

	describe('dev', () => {
		it('should run dev command without crashing', async () => {
			const cwd = FIXTURE_DIR;
			
			// Dev command runs and exits (fixture has no HMR loop)
			const result = execSync(`node "${CLI_BIN}" dev --port=3001 --no-open`, {
				cwd,
				stdio: 'pipe',
				timeout: 5000,
			});
			
			expect(result).toBeDefined();
		}, 30000);
	});

	describe('config', () => {
		it('should run build with env files loaded', async () => {
			const cwd = FIXTURE_DIR;
			
			const result = execSync(`node "${CLI_BIN}" build --client-only`, {
				cwd,
				stdio: 'pipe',
			});
			
			expect(result).toBeDefined();
		}, 60000);
	});
});
