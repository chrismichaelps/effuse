import { DevService } from './services/dev.js';
import { BuildService } from './services/build.js';
import { TypeCheckService } from './services/typecheck.js';
import { ManifestResolver, DEFAULT_SERVER_MANIFEST_PATH } from './services/manifest.js';
import { CliConfigService } from './config/index.js';
import { APP_NAME, COMMANDS, PRESETS } from './constants.js';
import { parseNumber } from './utils/index.js';
import { CliError } from './errors/index.js';
import { parseArgs } from './utils/args.js';

type Preset = 'node' | 'vercel' | 'netlify' | 'cloudflare';

const VALID_PRESETS: readonly string[] = Object.values(PRESETS);

const validatePort = (rawPort: unknown): number | undefined => {
	if (rawPort === undefined) return undefined;
	if (typeof rawPort !== 'string' && typeof rawPort !== 'number') {
		throw new CliError({ message: 'Invalid port. Must be an integer between 1 and 65535.' });
	}
	const rawPortText = String(rawPort);
	const port = parseNumber(rawPortText);
	if (port === undefined || !Number.isInteger(port) || port < 1 || port > 65535) {
		throw new CliError({ message: `Invalid port: "${rawPortText}". Must be an integer between 1 and 65535.` });
	}
	return port;
};

const validatePreset = (preset: string | undefined): Preset | undefined => {
	if (preset === undefined) return undefined;
	if (!VALID_PRESETS.includes(preset)) {
		throw new CliError({
			message: `Invalid preset: "${preset}". Valid presets: ${VALID_PRESETS.join(', ')}.`,
		});
	}
	return preset as Preset;
};

const validateHost = (host: string | undefined): string | undefined => {
	if (host === undefined) return undefined;
	if (host.length === 0 || host.length > 253) {
		throw new CliError({ message: `Invalid host: "${host}". Must be between 1 and 253 characters.` });
	}
	return host;
};

const validateFilePath = (filePath: unknown): string | undefined => {
	if (filePath === undefined) return undefined;
	if (typeof filePath !== 'string' || filePath.length === 0) {
		throw new CliError({ message: 'Manifest file path must be a non-empty string.' });
	}
	return filePath;
};

const validateOptionalString = (
	value: unknown,
	label: string
): string | undefined => {
	if (value === undefined) return undefined;
	if (typeof value !== 'string' || value.length === 0) {
		throw new CliError({ message: `${label} must be a non-empty string.` });
	}
	return value;
};

const printHelp = (version: string) => {
	console.log(`${APP_NAME}/${version}`);
	console.log();
	console.log('Usage:');
	console.log(`  $ ${APP_NAME} <command> [options]`);
	console.log();
	console.log('Commands:');
	console.log(`  ${COMMANDS.DEV}          Start the development server with HMR and SSR`);
	console.log(`  ${COMMANDS.BUILD}        Build the Effuse application for production`);
	console.log(`  ${COMMANDS.TYPECHECK}    Run TypeScript type check`);
	console.log(`  ${COMMANDS.MANIFEST}     Inspect generated Effuse server routes and actions`);
	console.log();
	console.log('Options:');
	console.log('  -h, --help       Display this message');
	console.log('  -v, --version    Display version number');
	console.log();
	console.log('Dev Options:');
	console.log('  -p, --port <port>      Port to run the dev server on');
	console.log('  -h, --host <host>      Host to bind to');
	console.log('  --no-open              Skip opening browser');
	console.log('  --https                Enable HTTPS for development');
	console.log('  --base-path <path>     Base path for routing');
	console.log('  --verbose              Enable verbose logging');
	console.log('  --quiet                Suppress non-error output');
	console.log();
	console.log('Build Options:');
	console.log('  --client-only          Bypass SSR build and only output static assets');
	console.log('  --analyze              Generate bundle analysis report');
	console.log('  --preset <preset>      Build preset (node, vercel, netlify, cloudflare)');
	console.log('  --verbose              Enable verbose logging');
	console.log('  --quiet                Suppress non-error output');
	console.log();
	console.log('Manifest Options:');
	console.log(`  -f, --file <path>      Server manifest JSON file (default: ${DEFAULT_SERVER_MANIFEST_PATH})`);
	console.log('  --client-out <path>   Write a typed server client module');
	console.log('  --client-factory <id> Client factory export name');
	console.log('  --client-manifest <id> Manifest export name');
	console.log('  --client-type <id>    Client type export name');
	console.log('  --client-import <pkg> Import source for Effuse runtime helpers');
};

export const runCli = async (args: string[]) => {
	const configService = new CliConfigService();
	const devService = new DevService();
	const buildService = new BuildService();
	const typeCheckService = new TypeCheckService();
	const manifestResolver = new ManifestResolver();

	const cwd = process.cwd();
	const config = await configService.load(cwd);

	const parsed = parseArgs(args);

	if (parsed.options.help || parsed.options.h) {
		printHelp(config.version);
		return;
	}

	if (parsed.options.version || parsed.options.v) {
		console.log(`${APP_NAME}/${config.version}`);
		return;
	}

	const commandName = parsed.command;
	if (!commandName) {
		printHelp(config.version);
		console.error(`\n[${APP_NAME}] No command specified. Run '${APP_NAME} --help' for usage.`);
		process.exitCode = 1;
		return;
	}

	if (commandName === COMMANDS.DEV) {
		const opts = parsed.options;
		const port = validatePort(opts.p ?? opts.port);
		const host = validateHost((opts.h ?? opts.host) as string | undefined);
		try {
			await devService.run({
				port,
				host,
				open: opts.open === false ? false : undefined,
				https: opts.https as boolean | undefined,
				basePath: (opts.base_path ?? opts['base-path']) as string | undefined,
			}, cwd);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`\n[${APP_NAME}] Error: ${message}\n`);
			process.exitCode = 1;
		}
		return;
	}

	if (commandName === COMMANDS.BUILD) {
		const opts = parsed.options;
		const preset = validatePreset(opts.preset as string | undefined);
		try {
			await buildService.run({
				clientOnly: opts.client_only as boolean | undefined,
				analyze: opts.analyze as boolean | undefined,
				preset,
			}, cwd);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`\n[${APP_NAME}] Error: ${message}\n`);
			process.exitCode = 1;
		}
		return;
	}

	if (commandName === COMMANDS.TYPECHECK) {
		try {
			await typeCheckService.run(cwd);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`\n[${APP_NAME}] Error: ${message}\n`);
			process.exitCode = 1;
		}
		return;
	}

	if (commandName === COMMANDS.MANIFEST) {
		const opts = parsed.options;
		const filePath = validateFilePath(opts.f ?? opts.file);
		const clientOut = validateFilePath(opts.client_out ?? opts['client-out']);
		const clientFactory = validateOptionalString(
			opts.client_factory ?? opts['client-factory'],
			'Client factory name'
		);
		const clientManifest = validateOptionalString(
			opts.client_manifest ?? opts['client-manifest'],
			'Client manifest name'
		);
		const clientType = validateOptionalString(
			opts.client_type ?? opts['client-type'],
			'Client type name'
		);
		const clientImportSource = validateOptionalString(
			opts.client_import ?? opts['client-import'],
			'Client import source'
		);
		try {
			const manifest = manifestResolver.resolveLayerServerManifestFile(cwd, filePath);
			if (!manifest) {
				throw new CliError({
					message: `Server manifest not found or invalid: ${filePath ?? DEFAULT_SERVER_MANIFEST_PATH}`,
				});
			}
			if (clientOut) {
				const outputPath = manifestResolver.writeLayerServerClientModule(
					cwd,
					clientOut,
					manifest,
					{
						...(clientFactory ? { factoryName: clientFactory } : {}),
						...(clientManifest ? { manifestName: clientManifest } : {}),
						...(clientType ? { clientTypeName: clientType } : {}),
						...(clientImportSource ? { importSource: clientImportSource } : {}),
					}
				);
				console.log(`[${APP_NAME}] Generated server client: ${outputPath}`);
			}
			console.log(manifestResolver.formatLayerServerManifest(manifest));
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`\n[${APP_NAME}] Error: ${message}\n`);
			process.exitCode = 1;
		}
		return;
	}

	console.error(`\n[${APP_NAME}] Unknown command: "${commandName}". Run '${APP_NAME} --help' for usage.`);
	process.exitCode = 1;
};
