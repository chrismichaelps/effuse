import { resolve, extname } from 'node:path';
import { existsSync, statSync } from 'node:fs';

export const PUBLIC_EXTENSIONS = [
	'.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
	'.woff', '.woff2', '.ttf', '.eot', '.otf',
	'.mp4', '.webm', '.mp3', '.wav', '.ogg',
	'.pdf', '.zip', '.gz', '.tar',
] as const;

export const isPublicFile = (url: string): boolean => {
	return PUBLIC_EXTENSIONS.some(ext => url.endsWith(ext)) || url.startsWith('/public/');
};

export const isCssRequest = (url: string): boolean => {
	return url.endsWith('.css');
};

export const isJsRequest = (url: string): boolean => {
	return url.endsWith('.js') || url.endsWith('.mjs') || url.endsWith('.ts') ||
		url.includes('.js?') || url.includes('.ts?');
};

export const isAssetRequest = (url: string): boolean => {
	return isPublicFile(url) || isCssRequest(url) || isJsRequest(url);
};

export const resolveFilePath = (cwd: string, file: string): string => {
	const path = resolve(cwd, file);
	if (!existsSync(path)) return '';
	const stat = statSync(path);
	return stat.isFile() ? path : '';
};

export const getFileExtension = (filename: string): string => {
	return extname(filename).toLowerCase();
};

export const isServerEntry = (file: string): boolean => {
	const ext = getFileExtension(file);
	return ext === '.ts' || ext === '.js' || ext === '.mjs';
};

export const normalizeBasePath = (basePath: string): string => {
	if (!basePath.startsWith('/')) return '/' + basePath;
	if (!basePath.endsWith('/')) return basePath + '/';
	return basePath;
};

export const joinUrl = (...parts: string[]): string => {
	return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
};