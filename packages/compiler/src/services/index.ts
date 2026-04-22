/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

export {
	containsSignalAccess,
	isEventHandler,
	isAlreadyWrapped,
	isAssignment,
	analyzeNode,
	createAccessorSet,
	createPrefixSet,
	type NodeAnalysis,
} from './ast-analyzer.js';

export { SourceCache, createContentHash } from './source-cache.js';
