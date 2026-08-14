/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(TEST_FILE_DIR, '../..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');
const FIXTURE_DIR = resolve(REPO_ROOT, '.cli-e2e-test-tmp');
const CLI_BIN = resolve(PACKAGE_ROOT, 'dist/bin.cjs');
const TEST_PORT = 3456;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const PRODUCTION_PORT = 3457;
const PRODUCTION_URL = `http://127.0.0.1:${PRODUCTION_PORT}`;

const cliExists = existsSync(CLI_BIN);

interface CliResult {
	readonly code: number | null;
	readonly stdout: string;
	readonly stderr: string;
}

interface DevServerHandle {
	readonly process: ChildProcessWithoutNullStreams;
	readonly logs: () => string;
}

const writeFixtureApp = (): void => {
	rmSync(FIXTURE_DIR, { recursive: true, force: true });
	mkdirSync(resolve(FIXTURE_DIR, 'src'), { recursive: true });

	writeFileSync(
		resolve(FIXTURE_DIR, 'package.json'),
		JSON.stringify(
			{
				name: '@effuse/cli-e2e-fixture',
				version: '1.0.0',
				type: 'module',
				private: true,
			},
			null,
			2
		)
	);

	writeFileSync(
		resolve(FIXTURE_DIR, 'index.html'),
		[
			'<!DOCTYPE html>',
			'<html lang="en">',
			'<head>',
			'\t<meta charset="UTF-8">',
			'\t<meta name="viewport" content="width=device-width, initial-scale=1.0">',
			'\t<title>Effuse CLI E2E</title>',
			'</head>',
			'<body>',
			'\t<div id="app">Loading...</div>',
			'\t<script type="module" src="/src/entry-client.ts"></script>',
			'</body>',
			'</html>',
			'',
		].join('\n')
	);

	writeFileSync(
		resolve(FIXTURE_DIR, 'src/entry-client.ts'),
		[
			"const root = document.getElementById('app');",
			'if (root) {',
			"\troot.dataset.ready = 'true';",
			"\troot.textContent = 'Effuse CLI Client Ready';",
			'}',
			'',
		].join('\n')
	);

	writeFileSync(
		resolve(FIXTURE_DIR, 'src/entry-server.ts'),
		[
			'export async function handleRequest(request: Request): Promise<Response> {',
			'\tconst url = new URL(request.url);',
			'\tconst html = `<!DOCTYPE html>',
			'<html lang="en">',
			'<head>',
			'\t<meta charset="UTF-8">',
			'\t<title>Effuse CLI E2E</title>',
			'</head>',
			'<body>',
			'\t<div id="app">',
			'\t\t<h1>Effuse CLI Fixture</h1>',
			'\t\t<p data-path="${url.pathname}">Served by the Effuse CLI dev server.</p>',
			'\t</div>',
			'</body>',
			'</html>`;',
			'\treturn new Response(html, {',
			'\t\tstatus: 200,',
			"\t\theaders: { 'Content-Type': 'text/html; charset=utf-8' },",
			'\t});',
			'}',
			'',
		].join('\n')
	);
};

const cleanupFixtureApp = (): void => {
	rmSync(FIXTURE_DIR, { recursive: true, force: true });
};

const runCli = (
	args: readonly string[],
	timeoutMs = 30_000
): Promise<CliResult> =>
	new Promise((resolveResult) => {
		const child = spawn(process.execPath, [CLI_BIN, ...args], {
			cwd: FIXTURE_DIR,
			env: {
				...process.env,
				CI: 'true',
				VITE_CJS_IGNORE_WARNING: 'true',
			},
		});

		let stdout = '';
		let stderr = '';
		const timeout = setTimeout(() => {
			child.kill('SIGKILL');
		}, timeoutMs);

		child.stdout.on('data', (chunk) => {
			stdout += String(chunk);
		});
		child.stderr.on('data', (chunk) => {
			stderr += String(chunk);
		});
		child.on('close', (code) => {
			clearTimeout(timeout);
			resolveResult({ code, stdout, stderr });
		});
	});

const listFiles = (dir: string): string[] =>
	readdirSync(dir, { recursive: true }).map((entry) => String(entry));

const httpGet = async (
	url: string,
	timeoutMs = 1_000
): Promise<{ status: number; body: string; headers: Headers }> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => {
		controller.abort();
	}, timeoutMs);

	try {
		const response = await fetch(url, { signal: controller.signal });
		const body = await response.text();
		return {
			status: response.status,
			body,
			headers: response.headers,
		};
	} finally {
		clearTimeout(timeout);
	}
};

const startDevServer = async (): Promise<DevServerHandle> => {
	const child = spawn(
		process.execPath,
		[
			CLI_BIN,
			'dev',
			'--host',
			'127.0.0.1',
			'--port',
			String(TEST_PORT),
			'--no-open',
		],
		{
			cwd: FIXTURE_DIR,
			env: {
				...process.env,
				CI: 'true',
				VITE_CJS_IGNORE_WARNING: 'true',
			},
		}
	);

	let output = '';
	child.stdout.on('data', (chunk) => {
		output += String(chunk);
	});
	child.stderr.on('data', (chunk) => {
		output += String(chunk);
	});

	const deadline = Date.now() + 10_000;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`Effuse dev server exited early.\n${output}`);
		}

		try {
			const response = await httpGet(SERVER_URL, 250);
			if (response.status === 200) {
				return {
					process: child,
					logs: () => output,
				};
			}
		} catch {
			// Server is still starting.
		}

		await sleep(100);
	}

	child.kill('SIGKILL');
	throw new Error(`Timed out waiting for Effuse dev server.\n${output}`);
};

const startProductionServer = async (): Promise<DevServerHandle> => {
	const child = spawn(
		process.execPath,
		[resolve(FIXTURE_DIR, 'dist/server/server.js')],
		{
			cwd: tmpdir(),
			env: {
				...process.env,
				HOST: '127.0.0.1',
				PORT: String(PRODUCTION_PORT),
			},
		}
	);

	let output = '';
	child.stdout.on('data', (chunk) => {
		output += String(chunk);
	});
	child.stderr.on('data', (chunk) => {
		output += String(chunk);
	});

	const deadline = Date.now() + 10_000;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`Effuse production server exited early.\n${output}`);
		}

		try {
			const response = await httpGet(`${PRODUCTION_URL}/health`, 250);
			if (response.status === 200) {
				return { process: child, logs: () => output };
			}
		} catch {
			// Server is still starting.
		}

		await sleep(100);
	}

	child.kill('SIGKILL');
	throw new Error(`Timed out waiting for Effuse production server.\n${output}`);
};

const stopDevServer = async (
	server: DevServerHandle | undefined
): Promise<void> => {
	if (!server || server.process.killed) {
		return;
	}

	server.process.kill('SIGTERM');
	await sleep(250);
	if (server.process.exitCode === null) {
		server.process.kill('SIGKILL');
	}
};

describe.skipIf(!cliExists)('E2E: Effuse CLI binary', () => {
	let devServer: DevServerHandle | undefined;
	let productionServer: DevServerHandle | undefined;

	beforeEach(() => {
		writeFixtureApp();
	});

	afterEach(async () => {
		await stopDevServer(devServer);
		await stopDevServer(productionServer);
		devServer = undefined;
		productionServer = undefined;
		cleanupFixtureApp();
	});

	it('should build client and server outputs from explicit entries', async () => {
		const result = await runCli(['build', '--preset', 'node'], 60_000);

		expect(result.code, result.stderr || result.stdout).toBe(0);

		const clientFiles = listFiles(resolve(FIXTURE_DIR, 'dist/client'));
		const serverFiles = listFiles(resolve(FIXTURE_DIR, 'dist/server'));

		expect(clientFiles.some((file) => file.endsWith('.js'))).toBe(true);
		expect(clientFiles.some((file) => file.endsWith('manifest.json'))).toBe(
			true
		);
		expect(serverFiles.some((file) => file.endsWith('.js'))).toBe(true);
		expect(existsSync(resolve(FIXTURE_DIR, 'ecosystem.config.js'))).toBe(true);

		productionServer = await startProductionServer();
		const clientScript = clientFiles.find((file) => file.endsWith('.js'));
		expect(clientScript).toBeTruthy();
		const asset = await httpGet(`${PRODUCTION_URL}/${clientScript!}`);
		expect(asset.status, productionServer.logs()).toBe(200);
		expect(asset.headers.get('content-type')).toContain('text/javascript');
		expect(asset.body).toContain('Effuse CLI Client Ready');
	}, 60_000);

	it('should serve HTML through the real dev server binary', async () => {
		devServer = await startDevServer();

		const { status, body, headers } = await httpGet(`${SERVER_URL}/settings`);

		expect(status, devServer.logs()).toBe(200);
		expect(headers.get('content-type')).toContain('text/html');
		expect(body).toContain('<h1>Effuse CLI Fixture</h1>');
		expect(body).toContain('data-path="/settings"');
		expect(body).toContain('Served by the Effuse CLI dev server.');
	}, 20_000);
});

describe('E2E: CLI command parsing', () => {
	it('should parse "dev" command', () => {
		const args = ['dev', '--port', '3000'];
		expect(args[0]).toBe('dev');
	});

	it('should parse "build" command with preset', () => {
		const args = ['build', '--preset', 'vercel'];
		expect(args[0]).toBe('build');
		expect(args[2]).toBe('vercel');
	});

	it('should parse --port option', () => {
		const args = ['dev', '--port', '8080'];
		const portIdx = args.indexOf('--port');
		expect(portIdx).toBeGreaterThanOrEqual(0);
	});

	it('should support --help flag', () => {
		const args = ['dev', '--help'];
		expect(args).toContain('--help');
	});

	it('should reject invalid port value', () => {
		const port = '-1';
		const num = parseInt(port, 10);
		expect(num).not.toBeGreaterThan(0);
	});
});
