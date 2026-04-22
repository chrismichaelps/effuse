/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

export {
	NodeTypes,
	DefaultSignalAccessors,
	DefaultEventHandlerPrefixes,
	ErrorCodes,
	type NodeType,
	type ErrorCode,
} from './constants/index.js';

export {
	type CompilerConfig,
	defaultConfig,
	mergeConfig,
} from './config/index.js';

export {
	ParseError,
	TransformError,
	GenerateError,
	ConfigError,
	CacheError,
	type CompilerError,
	isCompilerError,
	formatError,
} from './errors/index.js';

export {
	type NodeAnalysis,
	SourceCache,
	createContentHash,
} from './services/index.js';

export {
	transformSync,
	transformAsync,
	type TransformResult,
	type TransformStats,
} from './transformer/index.js';
// force release
