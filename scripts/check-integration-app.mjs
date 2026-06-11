#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { withIntegrationAppLock } from './integration-app-lock.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const appPackage = resolve(repoRoot, 'app/package.json');

const runnerArg = process.argv.find((arg) => arg.startsWith('--runner='));
const runner = runnerArg?.slice('--runner='.length) ?? 'pnpm';

if (runner !== 'pnpm' && runner !== 'bun') {
	console.error('Usage: node scripts/check-integration-app.mjs [--runner=pnpm|bun]');
	process.exit(1);
}

if (!existsSync(appPackage)) {
	console.log('No ignored /app integration sandbox found; skipping app checks.');
	process.exit(0);
}

const commands =
	runner === 'pnpm'
		? [
				['pnpm', ['--dir', 'packages/core', 'build']],
				['pnpm', ['--dir', 'app', 'typecheck']],
				['pnpm', ['--dir', 'app', 'build']],
			]
		: [
				['bun', ['run', '--cwd', 'packages/core', 'build']],
				['bun', ['run', '--cwd', 'app', 'typecheck']],
				['bun', ['run', '--cwd', 'app', 'build']],
			];

const run = (command, args) =>
	new Promise((resolveCommand, rejectCommand) => {
		const child = spawn(command, args, {
			cwd: repoRoot,
			stdio: 'inherit',
			shell: false,
		});

		child.on('error', rejectCommand);
		child.on('close', (code) => {
			if (code === 0) {
				resolveCommand();
				return;
			}
			rejectCommand(new Error(`${command} ${args.join(' ')} exited with ${code}`));
		});
	});

console.log(`Checking ignored Effuse app with ${runner}.`);
console.log('Order: core build -> app typecheck -> app build.');

await withIntegrationAppLock({ repoRoot }, async () => {
	for (const [command, args] of commands) {
		console.log(`\n> ${command} ${args.join(' ')}`);
		await run(command, args);
	}
});

console.log('\nEffuse app integration check passed.');
