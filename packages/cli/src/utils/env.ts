import { resolve } from 'node:path';
import { existsSync, statSync, readFileSync } from 'node:fs';
import * as nodeFs from 'node:fs/promises';
import { FileError } from '../errors/index.js';

export const readPackageJson = async (cwd: string): Promise<{ version: string } | null> => {
	const path = resolve(cwd, 'package.json');
	if (!existsSync(path)) return null;
	try {
		const content = await nodeFs.readFile(path, 'utf-8');
		return JSON.parse(content);
	} catch {
		return null;
	}
};

export const readPackageJsonSync = (cwd: string): { version: string } | null => {
	const path = resolve(cwd, 'package.json');
	if (!existsSync(path)) return null;
	try {
		const content = readFileSync(path, 'utf-8');
		return JSON.parse(content);
	} catch {
		return null;
	}
};

export const fileExists = async (path: string): Promise<boolean> => {
	try {
		const stat = await nodeFs.stat(path);
		return stat.isFile();
	} catch {
		return false;
	}
};

export const dirExists = async (path: string): Promise<boolean> => {
	try {
		const stat = await nodeFs.stat(path);
		return stat.isDirectory();
	} catch {
		return false;
	}
};

export const readEnvFile = async (path: string): Promise<Record<string, string>> => {
	const envVars: Record<string, string> = {};
	try {
		const content = await nodeFs.readFile(path, 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eqIdx = trimmed.indexOf('=');
			if (eqIdx === -1) continue;
			const key = trimmed.slice(0, eqIdx).trim();
			const value = trimmed.slice(eqIdx + 1).trim();
			if (key) envVars[key] = value;
		}
	} catch {
		// File doesn't exist or can't be read
	}
	return envVars;
};

export const loadEnvFiles = async (cwd: string): Promise<Record<string, string>> => {
	const result: Record<string, string> = {};
	const local = await readEnvFile(resolve(cwd, '.env.local'));
	const base = await readEnvFile(resolve(cwd, '.env'));
	return { ...base, ...local };
};

export const isTruthy = (value: string | undefined): boolean => {
	return value === 'true' || value === '1' || value === '';
};

export const parseNumber = (value: string | undefined): number | undefined => {
	if (value === undefined) return undefined;
	const num = Number(value);
	return isNaN(num) ? undefined : num;
};

export const parseBool = (value: string | undefined): boolean | undefined => {
	if (value === undefined) return undefined;
	return isTruthy(value);
};

export const resolveEntryPath = (cwd: string, entry: string): string => {
	const path = resolve(cwd, entry);
	if (!existsSync(path)) {
		throw new FileError({ message: `Entry file not found: ${entry}`, path });
	}
	if (!statSync(path).isFile()) {
		throw new FileError({ message: `Entry is not a file: ${entry}`, path });
	}
	return path;
};

export const resolveOutDir = (cwd: string, outDir: string): string => {
	const path = resolve(cwd, outDir);
	if (existsSync(path) && !statSync(path).isDirectory()) {
		throw new FileError({ message: `Output directory is not a directory: ${outDir}`, path });
	}
	return path;
};