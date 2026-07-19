export const APP_NAME = 'effuse' as const;

export const COMMANDS = {
	DEV: 'dev',
	BUILD: 'build',
	TYPECHECK: 'typecheck',
	MANIFEST: 'manifest',
} as const;

export const DEFAULT_CONFIG = {
	port: 3000,
	host: 'localhost',
	open: true,
	https: false,
	basePath: '/',
	outDirClient: 'dist/client',
	outDirServer: 'dist/server',
	entryClient: 'src/entry-client.ts',
	entryServer: 'src/entry-server.ts',
	minify: true,
	sourcemap: false,
	target: 'es2022' as const,
	analyze: false,
	effect: true,
	reactivity: 'signal' as const,
	ssr: true,
	hydrate: true,
} as const;

export const ENV_KEYS = {
	DESKTOP_PORT: 'PORT',
	DESKTOP_HOST: 'HOST',
	DESKTOP_EFFUSE_DEV_PORT: 'EFFUSE_DEV_PORT',
	DESKTOP_EFFUSE_DEV_HOST: 'EFFUSE_DEV_HOST',
	CI: 'CI',
	HTTPS: 'HTTPS',
	BASE_PATH: 'BASE_PATH',
	EFFUSE_BASE_PATH: 'EFFUSE_BASE_PATH',
	OUT_DIR_CLIENT: 'OUT_DIR_CLIENT',
	OUT_DIR_SERVER: 'OUT_DIR_SERVER',
	ENTRY_CLIENT: 'ENTRY_CLIENT',
	ENTRY_SERVER: 'ENTRY_SERVER',
	MINIFY: 'MINIFY',
	SOURCE_MAP: 'SOURCE_MAP',
	TARGET: 'TARGET',
	ANALYZE: 'ANALYZE',
	EFFECT: 'EFFECT',
	REACTIVITY: 'REACTIVITY',
	SSR: 'SSR',
	HYDRATE: 'HYDRATE',
} as const;

export const PRESETS = {
	NODE: 'node',
	BUN: 'bun',
	VERCEL: 'vercel',
	NETLIFY: 'netlify',
	CLOUDFLARE: 'cloudflare',
} as const;

export const FILE_EXTENSIONS = {
	CONFIG: ['.ts', '.mjs', '.js'],
	PUBLIC_DIR: 'public',
	ENV_LOCAL: '.env.local',
	ENV: '.env',
} as const;

export const HTTP_STATUS = {
	OK: 200,
	NOT_FOUND: 404,
	INTERNAL_ERROR: 500,
} as const;

export const SERVER_TIMEOUT_MS = 5000 as const;

export const BODY_PARSER_LIMIT = '10mb' as const;
