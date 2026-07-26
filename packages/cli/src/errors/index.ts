import { Data } from 'effect';

export class BuildError extends Data.TaggedError('BuildError')<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export class DevServerError extends Data.TaggedError('DevServerError')<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export class ConfigError extends Data.TaggedError('ConfigError')<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export class CliError extends Data.TaggedError('CliError')<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export class FileError extends Data.TaggedError('FileError')<{
	readonly message: string;
	readonly path?: string;
	readonly cause?: unknown;
}> {}