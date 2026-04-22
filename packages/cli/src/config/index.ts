import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, ENV_KEYS } from '../constants.js';
import { loadEnvFiles, isTruthy, parseNumber, parseBool } from '../utils/index.js';

export interface DevConfig {
	port: number;
	host: string;
	open: boolean;
	https: boolean;
	basePath: string;
}

export interface BuildConfig {
	outDirClient: string;
	outDirServer: string;
	entryClient: string;
	entryServer: string;
	minify: boolean;
	sourcemap: boolean;
	target: 'es2020' | 'es2021' | 'es2022' | 'esnext';
	analyze: boolean;
}

export interface RuntimeConfig {
	effect: boolean;
	reactivity: 'signal' | 'computed' | 'solid';
	ssr: boolean;
	hydrate: boolean;
}

export interface CliConfig {
	version: string;
	dev: DevConfig;
	build: BuildConfig;
	runtime: RuntimeConfig;
}

export class CliConfigService {
	async load(cwd: string): Promise<CliConfig> {
		const env = await loadEnvFiles(cwd);
		const isCI = isTruthy(env[ENV_KEYS.CI]);

		const version = this.getVersion(cwd);

		const dev: DevConfig = {
			port: parseNumber(env[ENV_KEYS.DESKTOP_PORT] ?? env[ENV_KEYS.DESKTOP_EFFUSE_DEV_PORT]) ?? DEFAULT_CONFIG.port,
			host: env[ENV_KEYS.DESKTOP_HOST] ?? env[ENV_KEYS.DESKTOP_EFFUSE_DEV_HOST] ?? DEFAULT_CONFIG.host,
			open: isCI ? false : (parseBool(env['OPEN']) ?? DEFAULT_CONFIG.open),
			https: parseBool(env[ENV_KEYS.HTTPS]) ?? DEFAULT_CONFIG.https,
			basePath: env[ENV_KEYS.BASE_PATH] ?? env[ENV_KEYS.EFFUSE_BASE_PATH] ?? DEFAULT_CONFIG.basePath,
		};

		const build: BuildConfig = {
			outDirClient: env[ENV_KEYS.OUT_DIR_CLIENT] ?? DEFAULT_CONFIG.outDirClient,
			outDirServer: env[ENV_KEYS.OUT_DIR_SERVER] ?? DEFAULT_CONFIG.outDirServer,
			entryClient: env[ENV_KEYS.ENTRY_CLIENT] ?? DEFAULT_CONFIG.entryClient,
			entryServer: env[ENV_KEYS.ENTRY_SERVER] ?? DEFAULT_CONFIG.entryServer,
			minify: parseBool(env[ENV_KEYS.MINIFY]) ?? DEFAULT_CONFIG.minify,
			sourcemap: parseBool(env[ENV_KEYS.SOURCE_MAP]) ?? DEFAULT_CONFIG.sourcemap,
			target: (env[ENV_KEYS.TARGET] ?? DEFAULT_CONFIG.target) as BuildConfig['target'],
			analyze: parseBool(env[ENV_KEYS.ANALYZE]) ?? DEFAULT_CONFIG.analyze,
		};

		const runtime: RuntimeConfig = {
			effect: parseBool(env[ENV_KEYS.EFFECT]) ?? DEFAULT_CONFIG.effect,
			reactivity: (env[ENV_KEYS.REACTIVITY] ?? DEFAULT_CONFIG.reactivity) as RuntimeConfig['reactivity'],
			ssr: parseBool(env[ENV_KEYS.SSR]) ?? DEFAULT_CONFIG.ssr,
			hydrate: parseBool(env[ENV_KEYS.HYDRATE]) ?? DEFAULT_CONFIG.hydrate,
		};

		return { version, dev, build, runtime };
	}

	private getVersion(cwd: string): string {
		try {
			const content = readFileSync(resolve(cwd, 'package.json'), 'utf-8');
			const pkg = JSON.parse(content) as { version?: string };
			return pkg.version ?? '1.0.0';
		} catch {
			return '1.0.0';
		}
	}
}