import { build as viteBuild, type InlineConfig } from 'vite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Console } from 'effect';
import { BuildError } from '../errors/index.js';
import { APP_NAME, DEFAULT_CONFIG, PRESETS } from '../constants.js';
import { fileExists } from '../utils/index.js';

export interface BuildOptions {
	readonly clientOnly?: boolean;
	readonly analyze?: boolean;
	readonly preset?: 'node' | 'vercel' | 'netlify' | 'cloudflare';
}

const buildVite = async (config: InlineConfig): Promise<unknown> => {
	try {
		const result = await viteBuild(config);
		return Array.isArray(result) ? result : [result];
	} catch (err) {
		throw new BuildError({ message: 'Vite build failed', cause: err });
	}
};

const validateBuildOutput = async (outDir: string): Promise<boolean> => {
	const manifestPath = resolve(outDir, 'manifest.json');
	const indexPath = resolve(outDir, 'index.html');
	return (await fileExists(manifestPath)) || (await fileExists(indexPath));
};

const generateBundleAnalysis = async (outDir: string) => {
	const manifestPath = resolve(outDir, 'manifest.json');
	if (!existsSync(manifestPath)) return;

	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
	let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bundle Analysis</title><style>body{font-family:-apple-system,sans-serif;padding:20px;background:#1a1a2e;color:#fff}h1{color:#e94560}.file{background:#16213e;padding:12px;margin:8px 0;border-radius:6px}.file-name{color:#4ecdc4;font-weight:600}</style></head><body><h1>Bundle Analysis</h1>`;

	for (const [name, chunk] of Object.entries(manifest)) {
		const size = (chunk as { file: string }).file;
		html += `<div class="file"><div class="file-name">${name}</div><div>${size}</div></div>`;
	}

	html += '</body></html>';
	writeFileSync(resolve(outDir, '.effuse/stats.html'), html);
};

const generateVercelConfig = (cwd: string) => {
	const config = {
		$schema: 'https://openapi.vercel.sh/vercel.json',
		framework: null,
		buildCommand: 'npm run build',
		outputDirectory: DEFAULT_CONFIG.outDirClient,
		installCommand: 'pnpm install',
		cleanUrls: true,
		trailingSlash: false,
		rewrites: [
			{
				source: `/${DEFAULT_CONFIG.outDirServer}/(.*)`,
				destination: `/${DEFAULT_CONFIG.outDirServer}/$1`,
			},
		],
		headers: [
			{
				source: '/(.*)',
				headers: [
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'X-XSS-Protection', value: '1; mode=block' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
				],
			},
		],
	};

	writeFileSync(resolve(cwd, 'vercel.json'), JSON.stringify(config, null, 2));
};

const generateNetlifyConfig = (cwd: string) => {
	const config = `[build]
  command = "npm run build"
  publish = "${DEFAULT_CONFIG.outDirClient}"

[build.environment]
  NODE_VERSION = "22"

[functions]
  directory = "${DEFAULT_CONFIG.outDirServer}"
  node_bundler = "zisi"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
`;

	writeFileSync(resolve(cwd, 'netlify.toml'), config);
};

const generateCloudflareConfig = (cwd: string) => {
	const config = `$schema = "./node_modules/wrangler/config-schema.json"
name = "effuse-app"
main = "${DEFAULT_CONFIG.outDirServer}/index.js"
compatibility_date = "${new Date().toISOString().split('T')[0]}"
workers_dev = false

[assets]
directory = "./${DEFAULT_CONFIG.outDirClient}"
binding = "ASSETS"
`;

	writeFileSync(resolve(cwd, 'wrangler.toml'), config);
};

const generateEcosystemConfig = (cwd: string) => {
	const config = `module.exports = {
  apps: [{
    name: "effuse-server",
    script: "${DEFAULT_CONFIG.outDirServer}/index.js",
    instances: 1,
    exec_mode: "cluster",
    max_memory_restart: "512M",
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}
`;

	writeFileSync(resolve(cwd, 'ecosystem.config.js'), config);
};

const copyPublicDir = (cwd: string, outDir: string) => {
	const publicDir = resolve(cwd, 'public');
	if (!existsSync(publicDir)) return;

	const destDir = resolve(outDir, 'public');

	const copyDir = async (src: string, dest: string) => {
		await mkdir(dest, { recursive: true });
		const entries = await readdir(src, { withFileTypes: true });
		for (const entry of entries) {
			const srcPath = resolve(src, entry.name);
			const destPath = resolve(dest, entry.name);
			if (entry.isDirectory()) {
				await copyDir(srcPath, destPath);
			} else {
				await copyFile(srcPath, destPath);
			}
		}
	};

	copyDir(publicDir, destDir);
};

export class BuildService {
	run(options: BuildOptions, cwd: string): Promise<void> {
		return this.runEffect(options, cwd);
	}

	private runEffect = async (options: BuildOptions, cwd: string): Promise<void> => {
		const preset = options.preset ?? PRESETS.NODE;

		Console.log(`\n[${APP_NAME}] Building for production...\n`);
		Console.log(`  Preset:   ${preset}`);
		Console.log(`  Client:   ${DEFAULT_CONFIG.outDirClient}`);
		Console.log(`  Server:   ${DEFAULT_CONFIG.outDirServer}`);
		Console.log(`  Minify:   ${DEFAULT_CONFIG.minify}\n`);

		Console.log(`[${APP_NAME}] Building client...`);
		const clientConfig: InlineConfig = {
			root: cwd,
			mode: 'production',
			build: {
				outDir: DEFAULT_CONFIG.outDirClient,
				emptyOutDir: true,
				manifest: true,
				minify: DEFAULT_CONFIG.minify,
				sourcemap: DEFAULT_CONFIG.sourcemap,
				target: DEFAULT_CONFIG.target,
				rollupOptions: { input: DEFAULT_CONFIG.entryClient },
			},
		};

		await buildVite(clientConfig);

		const clientValid = await validateBuildOutput(DEFAULT_CONFIG.outDirClient);
		if (!clientValid) {
			Console.warn(`Warning: Client build completed but no output in ${DEFAULT_CONFIG.outDirClient}`);
		}

		await copyPublicDir(cwd, DEFAULT_CONFIG.outDirClient);

		if (preset === PRESETS.CLOUDFLARE) {
			Console.log(`[${APP_NAME}] Copying public files for Cloudflare Workers...`);
			await copyPublicDir(cwd, DEFAULT_CONFIG.outDirServer);
		}

		if (options.clientOnly) {
			Console.log(`\n[${APP_NAME}] Client-only build complete\n`);
			return;
		}

		Console.log(`[${APP_NAME}] Building server...`);
		const serverConfig: InlineConfig = {
			root: cwd,
			mode: 'production',
			build: {
				outDir: DEFAULT_CONFIG.outDirServer,
				ssr: true,
				target: DEFAULT_CONFIG.target,
				minify: DEFAULT_CONFIG.minify,
				rollupOptions: { input: DEFAULT_CONFIG.entryServer },
			},
		};

		await buildVite(serverConfig);

		const serverValid = await validateBuildOutput(DEFAULT_CONFIG.outDirServer);
		if (!serverValid) {
			Console.warn(`Warning: Server build completed but no output in ${DEFAULT_CONFIG.outDirServer}`);
		}

		if (options.analyze) {
			Console.log(`[${APP_NAME}] Generating bundle analysis...`);
			await generateBundleAnalysis(DEFAULT_CONFIG.outDirClient);
			Console.log('Analysis saved to .effuse/stats.html');
		}

		if (preset === PRESETS.VERCEL) {
			Console.log(`[${APP_NAME}] Generating vercel.json...`);
			generateVercelConfig(cwd);
		}

		if (preset === PRESETS.NETLIFY) {
			Console.log(`[${APP_NAME}] Generating netlify.toml...`);
			generateNetlifyConfig(cwd);
		}

		if (preset === PRESETS.CLOUDFLARE) {
			Console.log(`[${APP_NAME}] Generating wrangler.toml...`);
			generateCloudflareConfig(cwd);
		}

		if (preset === PRESETS.NODE) {
			Console.log(`[${APP_NAME}] Generating ecosystem.config.json...`);
			generateEcosystemConfig(cwd);
		}

		Console.log(`\n[${APP_NAME}] Build complete!\n`);
		Console.log(`  Output directories:`);
		Console.log(`    Client: ${DEFAULT_CONFIG.outDirClient}`);
		Console.log(`    Server: ${DEFAULT_CONFIG.outDirServer}\n`);
		Console.log(`  Deployment config:`);
		Console.log(`    ${preset === PRESETS.VERCEL ? 'vercel.json' : preset === PRESETS.NETLIFY ? 'netlify.toml' : preset === PRESETS.CLOUDFLARE ? 'wrangler.toml' : 'ecosystem.config.js'}\n`);
	};
}