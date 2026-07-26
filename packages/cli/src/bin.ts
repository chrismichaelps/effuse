process.env.VITE_CJS_IGNORE_WARNING = 'true';

import { runCli } from './cli.js';

process.on('unhandledRejection', (reason) => {
	console.error('[effuse] Unhandled rejection:', reason);
	process.exitCode = 1;
});

process.on('uncaughtException', (error) => {
	console.error('[effuse] Uncaught exception:', error);
	process.exitCode = 1;
});

runCli(process.argv.slice(2)).catch((error: unknown) => {
	console.error('[effuse] Fatal error:', error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});