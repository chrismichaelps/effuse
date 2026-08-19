import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Fails when a tracked source embeds a literal NUL byte.
 *
 * A NUL is a legitimate *value* here -- a cache-key delimiter, a namespace
 * separator, a hostile test input -- but writing it as a raw byte rather than a
 * `\\u0000` escape makes the file binary to the tooling. git prints
 * "Binary files differ" instead of a diff, so changes to it cannot be reviewed,
 * and grep returns no matches rather than an error, so audits and refactors
 * skip it silently. That has already produced a wrong "dead code" conclusion in
 * this repo.
 *
 * The two tools disagree, which is what makes it insidious: git inspects only
 * the first 8000 bytes, so a NUL past that point leaves a file diffable but
 * still unsearchable.
 */
const EXTENSIONS = /\.(?:ts|tsx|js|mjs|cjs|json|md|css|html|eff)$/u;

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
	.split('\n')
	.filter((file) => file !== '' && EXTENSIONS.test(file));

const offenders = [];
for (const file of tracked) {
	let contents;
	try {
		contents = readFileSync(file);
	} catch {
		continue;
	}
	const index = contents.indexOf(0);
	if (index !== -1) offenders.push({ file, index });
}

if (offenders.length > 0) {
	console.error('Literal NUL bytes found in tracked sources:\n');
	for (const { file, index } of offenders) {
		console.error(`  ${file} (first at byte ${String(index)})`);
	}
	console.error(
		'\nWrite the NUL as a \\u0000 escape instead. The runtime value is identical,' +
			'\nand the file stays reviewable by git diff and searchable by grep.'
	);
	process.exitCode = 1;
} else {
	console.log(
		`[nul-bytes] ${String(tracked.length)} tracked sources, none binary`
	);
}
