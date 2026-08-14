#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withIntegrationAppLock } from './integration-app-lock.mjs';
import {
	resolvePackageManagerCommand,
	runCommand,
} from './run-with-integration-app-lock.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(scriptDir, '..');

export const runWorkspaceTests = async ({
	env = process.env,
	lockDir,
	nodeExecPath = process.execPath,
	repoRoot = defaultRepoRoot,
	run = runCommand,
} = {}) => {
	const pnpm = resolvePackageManagerCommand({
		args: [],
		command: 'pnpm',
		env,
		nodeExecPath,
	});

	return withIntegrationAppLock({ lockDir, repoRoot }, async () => {
		await run(pnpm.command, [...pnpm.args, 'test:scripts'], repoRoot);
		await run(pnpm.command, [...pnpm.args, '-r', 'test'], repoRoot);
	});
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
	try {
		await runWorkspaceTests({
			lockDir: process.env.EFFUSE_INTEGRATION_APP_LOCK_DIR,
		});
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(error?.exitCode ?? 1);
	}
}
