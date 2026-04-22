/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import {
	DefaultSignalAccessors,
	DefaultEventHandlerPrefixes,
	DefaultExtensions,
	DefaultExcludePatterns,
} from '../constants/index.js';

export interface CompilerConfig {
	autoUnwrap: boolean;
	autoUnwrapProps: boolean;
	extensions: string[];
	exclude: string[];
	sourceMaps: boolean;
	debug: boolean;
	signalAccessors: string[];
	eventHandlerPrefixes: string[];
	enableCache: boolean;
}

export const defaultConfig: CompilerConfig = {
	autoUnwrap: true,
	autoUnwrapProps: true,
	extensions: [...DefaultExtensions],
	exclude: [...DefaultExcludePatterns],
	sourceMaps: true,
	debug: false,
	signalAccessors: [...DefaultSignalAccessors],
	eventHandlerPrefixes: [...DefaultEventHandlerPrefixes],
	enableCache: true,
};

export const mergeConfig = (
	userConfig: Partial<CompilerConfig>
): CompilerConfig => {
	return { ...defaultConfig, ...userConfig };
};
