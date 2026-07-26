#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withIntegrationAppLock } from './integration-app-lock.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(scriptDir, '..');

export const parseCommand = (argv) => {
	const separator = argv.indexOf('--');
	const commandArgs = separator === -1 ? argv : argv.slice(separator + 1);
	const [command, ...args] = commandArgs;

	if (!command) {
		throw new Error(
			'Usage: node scripts/run-with-integration-app-lock.mjs -- <command> [...args]'
		);
	}

	return { args, command };
};

export const runCommand = (command, args, cwd) =>
	new Promise((resolveCommand, rejectCommand) => {
		const child = spawn(command, args, {
			cwd,
			stdio: 'inherit',
			shell: false,
		});

		child.on('error', rejectCommand);
		child.on('close', (code) => {
			if (code === 0) {
				resolveCommand();
				return;
			}

			const error = new Error(`${command} ${args.join(' ')} exited with ${code}`);
			error.exitCode = code ?? 1;
			rejectCommand(error);
		});
	});

export const runWithIntegrationAppLock = async ({
	args,
	command,
	lockDir,
	repoRoot = defaultRepoRoot,
	run = runCommand,
}) =>
	withIntegrationAppLock({ lockDir, repoRoot }, async () => {
		await run(command, args, repoRoot);
	});

if (fileURLToPath(import.meta.url) === process.argv[1]) {
	try {
		const { args, command } = parseCommand(process.argv.slice(2));
		await runWithIntegrationAppLock({
			args,
			command,
			lockDir: process.env.EFFUSE_INTEGRATION_APP_LOCK_DIR,
			repoRoot: defaultRepoRoot,
		});
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(error?.exitCode ?? 1);
	}
}
