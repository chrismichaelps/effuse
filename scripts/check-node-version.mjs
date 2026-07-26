#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootPackagePath = resolve(scriptDir, '../package.json');
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
const requiredRange = rootPackage.engines?.node;

const parseVersion = (value) => {
	const match = String(value).trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!match) {
		throw new Error(`Invalid Node version: ${value}`);
	}
	return match.slice(1).map(Number);
};

const compareVersions = (actual, required) => {
	for (let index = 0; index < 3; index += 1) {
		if (actual[index] > required[index]) return 1;
		if (actual[index] < required[index]) return -1;
	}
	return 0;
};

const requiredMatch = String(requiredRange).match(/^>=(\d+\.\d+\.\d+)$/);
if (!requiredMatch) {
	throw new Error(`Unsupported Node engine range in package.json: ${requiredRange}`);
}

const versionArg = process.argv.find((arg) =>
	arg.startsWith('--node-version=')
);
const actualVersion =
	versionArg?.slice('--node-version='.length) ?? process.versions.node;
const actual = parseVersion(actualVersion);
const required = parseVersion(requiredMatch[1]);

if (compareVersions(actual, required) < 0) {
	console.error(
		[
			`Effuse requires Node ${requiredRange}.`,
			`Current Node is v${actualVersion}.`,
			'Run `nvm use` from the repo root or install Node 22.14.0+ before running tests.',
		].join('\n')
	);
	process.exit(1);
}
