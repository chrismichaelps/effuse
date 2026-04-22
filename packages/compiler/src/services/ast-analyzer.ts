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
} from '../utils/index.js';
