import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const packagesRoot = join(repoRoot, 'packages');
const testFilePattern = /(?:^|\.)(?:test|spec)\.[cm]?[jt]sx?$/u;
const sourceFilePattern = /\.[cm]?[jt]sx?$/u;
const failureMaskPattern = /\|\||(?:&&|;)\s*true(?:\s|$)/u;

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const hasTestFiles = async (directory) => {
	const entries = await readdir(directory, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name === 'dist' || entry.name === 'node_modules') continue;

		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (await hasTestFiles(path)) return true;
			continue;
		}

		if (
			testFilePattern.test(entry.name) ||
			(directory.includes('__tests__') && sourceFilePattern.test(entry.name))
		) {
			return true;
		}
	}
	return false;
};

test('every tested public package participates in the workspace gate', async () => {
	const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(packagesRoot, entry.name));
	const publicPackages = [];

	for (const directory of packageDirectories) {
		const manifest = await readJson(join(directory, 'package.json'));
		if (manifest.private === true) continue;

		publicPackages.push(manifest.name);
		if (!(await hasTestFiles(join(directory, 'src')))) continue;

		assert.equal(
			typeof manifest.scripts?.test,
			'string',
			`${manifest.name} has tests but no test script`
		);
		assert.doesNotMatch(
			manifest.scripts.test,
			failureMaskPattern,
			`${manifest.name} test script can hide a failing command`
		);
	}

	assert.deepEqual(publicPackages.sort(), [
		'@effuse/cli',
		'@effuse/compiler',
		'@effuse/core',
		'@effuse/i18n',
		'@effuse/ink',
		'@effuse/query',
		'@effuse/router',
		'@effuse/server',
		'@effuse/store',
		'@effuse/use',
	]);
});

test('the root test command delegates to recursive package tests', async () => {
	const manifest = await readJson(join(repoRoot, 'package.json'));

	assert.match(manifest.scripts?.test ?? '', /pnpm test:workspace/u);
	assert.match(manifest.scripts?.['test:workspace'] ?? '', /pnpm -r test/u);
});
