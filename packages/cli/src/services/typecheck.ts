import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Console } from 'effect';
import { CliError } from '../errors/index.js';
import { APP_NAME } from '../constants.js';

const findTsc = (cwd: string): string => {
	const candidates = [
		resolve(cwd, 'node_modules', '.bin', 'tsc'),
		resolve(cwd, 'node_modules', '.bin', 'tsc.cmd'),
		resolve(cwd, '..', '..', 'node_modules', '.bin', 'tsc'),
		resolve(cwd, '..', '..', 'node_modules', '.bin', 'tsc.cmd'),
		'tsc',
	];
	for (const path of candidates) {
		if (existsSync(path)) return path;
	}
	return 'npx tsc';
};

export class TypeCheckService {
	run(cwd: string): Promise<void> {
		return this.runEffect(cwd);
	}

	private runEffect = async (cwd: string): Promise<void> => {
		const tscPath = findTsc(cwd);

		const hasConfig = existsSync(resolve(cwd, 'tsconfig.json'));
		if (!hasConfig) {
			Console.warn(`[${APP_NAME}] No tsconfig.json found in ${cwd}`);
			Console.warn(`[${APP_NAME}] Run 'tsc --init' to create one.`);
			throw new CliError({ message: 'tsconfig.json not found' });
		}

		Console.log(`[${APP_NAME}] Running TypeScript type check...\n`);

		try {
			execSync(`"${tscPath}" --noEmit`, {
				cwd,
				stdio: 'inherit',
			});
			Console.log(`\n[${APP_NAME}] Type check passed.\n`);
		} catch (error: unknown) {
			const exitCode = error instanceof Error && 'status' in error ? (error as { status: number }).status : 1;
			throw new CliError({ message: `Type check failed with exit code ${exitCode}` });
		}
	};
}