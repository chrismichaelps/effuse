/**
 * Simple CLI argument parser. Replaces cac for basic command/option parsing.
 */
export interface ParsedArgs {
	command: string | null;
	options: Record<string, unknown>;
	args: string[];
}

const parseOptionValue = (value: string): string | boolean | number => {
	if (value === 'true') return true;
	if (value === 'false') return false;
	const num = Number(value);
	if (!isNaN(num) && String(num) === value) return num;
	return value;
};

export const parseArgs = (argv: string[]): ParsedArgs => {
	const options: Record<string, unknown> = {};
	const positional: string[] = [];
	let i = 0;

	while (i < argv.length) {
		const arg = argv[i];

		if (arg === '--') {
			positional.push(...argv.slice(i + 1));
			break;
		}

		if (arg.startsWith('--')) {
			const eqIdx = arg.indexOf('=');
			if (eqIdx !== -1) {
				const key = arg.slice(2, eqIdx).replace(/-/g, '_');
				const value = arg.slice(eqIdx + 1);
				options[key] = parseOptionValue(value);
			} else if (arg.startsWith('--no-')) {
				const key = arg.slice(5).replace(/-/g, '_');
				options[key] = false;
			} else {
				const key = arg.slice(2).replace(/-/g, '_');
				const next = argv[i + 1];
				if (next && !next.startsWith('-')) {
					options[key] = parseOptionValue(next);
					i++;
				} else {
					options[key] = true;
				}
			}
		} else if (arg.startsWith('-') && arg.length > 1) {
			const key = arg.slice(1);
			const next = argv[i + 1];
			if (next && !next.startsWith('-')) {
				options[key] = parseOptionValue(next);
				i++;
			} else {
				options[key] = true;
			}
		} else {
			positional.push(arg);
		}
		i++;
	}

	return {
		command: positional[0] ?? null,
		options,
		args: positional.slice(1),
	};
};