/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { buildCatalogSafe } from '../api/catalog.js';
import { compareCatalogs } from '../catalog/changes.js';
import { ChangeSeverity } from '../catalog/index.js';
import { reviewCatalog } from '../analysis/index.js';
import {
	generateCatalogTypes,
	generateTypes,
	type CatalogTypesOptions,
} from '../api/typegen.js';
import type { Catalog } from '../catalog/index.js';

/** Everything the command touches outside itself. */
export interface NexCommandIO {
	/** Read a file, throwing if it is not there. */
	readonly read: (path: string) => string;
	/** Write a file, making whatever it takes to hold it. */
	readonly write: (path: string, contents: string) => void;
	/** Say something to whoever ran this. */
	readonly out: (line: string) => void;
	/** Say something went wrong. */
	readonly error: (line: string) => void;
}

const USAGE = [
	'nex <command> [options]',
	'',
	'  check <catalog>              Build the catalog and report what does not hold together',
	'  review <catalog>             Say what a working catalog makes impossible later',
	'  diff <before> <after>        Say what changed, and fail on anything that breaks a client',
	'  typegen <catalog>            Write the TypeScript for a catalog, or for a request',
	'',
	'  --out <path>                 Write to a file rather than saying it',
	'  --request <path>             Write the types of one request instead of the catalog',
	'  --scalar <Name=Type>         Say what a scalar reads as; may be given more than once',
	'  --no-naming                  Leave names out of what a review says',
].join('\n');

/** What the arguments after a command said. */
interface Options {
	readonly paths: readonly string[];
	readonly out?: string | undefined;
	readonly request?: string | undefined;
	readonly scalars: Readonly<Record<string, string>>;
	readonly naming: boolean;
}

const parse = (argv: readonly string[]): Options => {
	const paths: string[] = [];
	const scalars: Record<string, string> = {};
	let out: string | undefined;
	let request: string | undefined;
	let naming = true;

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];

		if (argument === '--out') {
			index += 1;
			out = argv[index];
			continue;
		}
		if (argument === '--request') {
			index += 1;
			request = argv[index];
			continue;
		}
		if (argument === '--scalar') {
			index += 1;
			const [name, written] = (argv[index] ?? '').split('=');
			if (name !== undefined && written !== undefined && name !== '') {
				scalars[name] = written;
			}
			continue;
		}
		if (argument === '--no-naming') {
			naming = false;
			continue;
		}
		if (argument !== undefined && !argument.startsWith('-'))
			paths.push(argument);
	}

	return {
		paths,
		...(out === undefined ? {} : { out }),
		...(request === undefined ? {} : { request }),
		scalars,
		naming,
	};
};

/** Read a catalog, or say why it could not be read. */
const catalogAt = (
	path: string | undefined,
	io: NexCommandIO
): Catalog | undefined => {
	if (path === undefined) {
		io.error('This command needs a catalog to work on');
		return undefined;
	}

	let source: string;
	try {
		source = io.read(path);
	} catch (cause) {
		io.error(cause instanceof Error ? cause.message : String(cause));
		return undefined;
	}

	const built = buildCatalogSafe(source);
	if (built.success) return built.catalog;

	for (const problem of built.errors) io.error(`${path}: ${problem.message}`);
	return undefined;
};

const check = (options: Options, io: NexCommandIO): number => {
	const catalog = catalogAt(options.paths[0], io);
	if (catalog === undefined) return 1;

	io.out(`${String(options.paths[0])}: holds together`);
	return 0;
};

const review = (options: Options, io: NexCommandIO): number => {
	const catalog = catalogAt(options.paths[0], io);
	if (catalog === undefined) return 1;

	const notices = reviewCatalog(catalog, { naming: options.naming });
	if (notices.length === 0) {
		io.out(`${String(options.paths[0])}: nothing to say`);
		return 0;
	}

	for (const notice of notices) {
		io.out(`${notice.code}  ${notice.coordinate}: ${notice.message}`);
	}
	return 1;
};

const diff = (options: Options, io: NexCommandIO): number => {
	const [beforePath, afterPath] = options.paths;

	const before = catalogAt(beforePath, io);
	if (before === undefined) return 1;

	if (afterPath === undefined) {
		io.error('This command needs a catalog to compare against');
		return 1;
	}
	const after = catalogAt(afterPath, io);
	if (after === undefined) return 1;

	const changes = compareCatalogs(before, after);
	for (const change of changes) {
		io.out(`${change.severity}  ${change.coordinate}: ${change.message}`);
	}

	// A change that breaks a client is what a build should stop for; the rest
	// is worth reading and worth shipping.
	return changes.some((change) => change.severity === ChangeSeverity.BREAKING)
		? 1
		: 0;
};

const typegen = (options: Options, io: NexCommandIO): number => {
	const catalog = catalogAt(options.paths[0], io);
	if (catalog === undefined) return 1;

	const written: CatalogTypesOptions = { scalars: options.scalars };

	let types: string;
	try {
		types =
			options.request === undefined
				? generateCatalogTypes(catalog, written)
				: generateTypes(io.read(options.request), catalog, {
						scalars: options.scalars,
					});
	} catch (cause) {
		io.error(cause instanceof Error ? cause.message : String(cause));
		return 1;
	}

	if (options.out === undefined) io.out(types);
	else io.write(options.out, types);

	return 0;
};

/**
 * Run one nex command, and say what a shell should exit with.
 *
 * Everything outside the command is passed in, so what it does can be watched
 * without a file system or a process: what a build runs and what a test runs
 * are the same code.
 *
 * Zero means nothing to act on. One means something a build should stop for -
 * a catalog that does not hold together, a review with something to say, a
 * change that breaks a client.
 */
export const runNexCommand = (
	argv: readonly string[],
	io: NexCommandIO
): number => {
	const [name, ...rest] = argv;

	if (name === '--help' || name === '-h' || name === 'help') {
		io.out(USAGE);
		return 0;
	}

	const options = parse(rest);

	switch (name) {
		case 'check':
			return check(options, io);
		case 'review':
			return review(options, io);
		case 'diff':
			return diff(options, io);
		case 'typegen':
			return typegen(options, io);
		default:
			io.error(
				name === undefined
					? `No command given.\n\n${USAGE}`
					: `Unknown command "${name}".\n\n${USAGE}`
			);
			return 1;
	}
};
