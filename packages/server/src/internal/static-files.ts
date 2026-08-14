/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { createReadStream } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { FetchHandler } from '../contract.js';

export interface StaticFileOptions {
	/** Absolute filesystem path or file URL containing the client build. */
	readonly root: string | URL;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
	'.avif': 'image/avif',
	'.css': 'text/css; charset=utf-8',
	'.gif': 'image/gif',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.ogg': 'audio/ogg',
	'.otf': 'font/otf',
	'.pdf': 'application/pdf',
	'.png': 'image/png',
	'.svg': 'image/svg+xml; charset=utf-8',
	'.ttf': 'font/ttf',
	'.txt': 'text/plain; charset=utf-8',
	'.wasm': 'application/wasm',
	'.webm': 'video/webm',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.xml': 'application/xml; charset=utf-8',
};

const HASHED_ASSET = /-[A-Za-z0-9_-]{8,}\.[^.]+$/u;
const RESERVED_PATHS = ['/api', '/_effuse'] as const;

interface StaticFile {
	readonly contentType: string;
	readonly etag: string;
	readonly lastModified: string;
	readonly path: string;
	readonly size: number;
}

const isWithin = (root: string, target: string): boolean => {
	const path = relative(root, target);
	return path === '' || (!path.startsWith('..') && !isAbsolute(path));
};

const isMissingFileError = (error: unknown): boolean => {
	const code = (error as { code?: unknown } | null)?.code;
	return code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP';
};

const decodeStaticPath = (request: Request): string | null => {
	if (request.method !== 'GET' && request.method !== 'HEAD') return null;
	const pathname = new URL(request.url).pathname;
	if (
		RESERVED_PATHS.some(
			(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
		)
	) {
		return null;
	}

	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	if (
		decoded.includes('\0') ||
		decoded.includes('\\') ||
		decoded.endsWith('/')
	) {
		return null;
	}
	const segments = decoded.split('/');
	if (
		segments.some(
			(segment) =>
				segment === '.' || segment === '..' || segment.startsWith('.')
		)
	) {
		return null;
	}
	return decoded;
};

const cacheControl = (pathname: string): string =>
	pathname.startsWith('/assets/') && HASHED_ASSET.test(pathname)
		? 'public, max-age=31536000, immutable'
		: 'public, max-age=0, must-revalidate';

const etagFor = (size: number, mtimeMs: number): string =>
	`W/"${size.toString(16)}-${Math.trunc(mtimeMs).toString(16)}"`;

const buildStaticFileIndex = async (
	configuredRoot: string
): Promise<ReadonlyMap<string, StaticFile>> => {
	let root: string;
	try {
		root = await realpath(configuredRoot);
	} catch (error) {
		if (isMissingFileError(error)) return new Map();
		throw error;
	}

	const files = new Map<string, StaticFile>();
	const visit = async (directory: string, pathname: string): Promise<void> => {
		let entries;
		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch (error) {
			if (isMissingFileError(error)) return;
			throw error;
		}

		await Promise.all(
			entries.map(async (entry): Promise<void> => {
				if (entry.name.startsWith('.') || entry.name.includes('\\')) return;
				const entryPath = join(directory, entry.name);
				const entryUrl = `${pathname}/${entry.name}`;
				// Build output is immutable. Rejecting links at index time removes
				// link traversal and keeps request dispatch entirely in memory.
				if (entry.isSymbolicLink()) return;
				if (entry.isDirectory()) {
					const realDirectory = await realpath(entryPath);
					if (isWithin(root, realDirectory)) {
						await visit(realDirectory, entryUrl);
					}
					return;
				}
				if (!entry.isFile()) return;

				try {
					const filePath = await realpath(entryPath);
					if (!isWithin(root, filePath)) return;
					const fileStat = await stat(filePath);
					if (!fileStat.isFile()) return;
					files.set(entryUrl, {
						contentType:
							CONTENT_TYPES[extname(filePath).toLowerCase()] ??
							'application/octet-stream',
						etag: etagFor(fileStat.size, fileStat.mtimeMs),
						lastModified: fileStat.mtime.toUTCString(),
						path: filePath,
						size: fileStat.size,
					});
				} catch (error) {
					if (!isMissingFileError(error)) throw error;
				}
			})
		);
	};

	await visit(root, '');
	return files;
};

const createBody = (
	path: string,
	signal: AbortSignal
): ReadableStream<Uint8Array> => {
	const source = createReadStream(path);
	const abort = (): void => {
		source.destroy(new DOMException('The request was aborted.', 'AbortError'));
	};
	if (signal.aborted) abort();
	else {
		signal.addEventListener('abort', abort, { once: true });
		source.once('close', () => {
			signal.removeEventListener('abort', abort);
		});
	}
	return Readable.toWeb(source) as ReadableStream<Uint8Array>;
};

/**
 * Serves exact files from a client build before falling through to the app.
 * The immutable output tree is indexed once by real path. Requests then use an
 * exact in-memory lookup, so application routes do not incur filesystem work.
 */
export const withStaticFiles = (
	handler: FetchHandler,
	options: StaticFileOptions
): FetchHandler => {
	const configuredRoot = resolve(
		options.root instanceof URL ? fileURLToPath(options.root) : options.root
	);
	const filesPromise = buildStaticFileIndex(configuredRoot);

	return async (request): Promise<Response> => {
		const pathname = decodeStaticPath(request);
		if (!pathname) return handler(request);
		const file = (await filesPromise).get(pathname);
		if (!file) return handler(request);

		const headers = new Headers({
			'Cache-Control': cacheControl(pathname),
			'Content-Length': String(file.size),
			'Content-Type': file.contentType,
			ETag: file.etag,
			'Last-Modified': file.lastModified,
			'X-Content-Type-Options': 'nosniff',
		});
		if (request.headers.get('If-None-Match') === file.etag) {
			headers.delete('Content-Length');
			return new Response(null, { status: 304, headers });
		}
		return new Response(
			request.method === 'HEAD' ? null : createBody(file.path, request.signal),
			{ status: 200, headers }
		);
	};
};
