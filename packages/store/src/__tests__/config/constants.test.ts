import { describe, it, expect, beforeEach } from 'vitest';
import {
	getStoreConfig,
	resetStoreConfigCache,
	STORAGE_PREFIX,
	ROOT_SCOPE_ID,
	DEFAULT_TIMEOUT_MS,
} from '../../config/constants.js';

describe('config / constants', () => {
	beforeEach(() => {
		resetStoreConfigCache();
	});

	it('should export constants', () => {
		expect(STORAGE_PREFIX).toBe('effuse-store:');
		expect(ROOT_SCOPE_ID).toBe('__root__');
		expect(DEFAULT_TIMEOUT_MS).toBe(5000);
	});

	it('should load store config', () => {
		const config = getStoreConfig();
		expect(typeof config.persistByDefault).toBe('boolean');
		expect(typeof config.storagePrefix).toBe('string');
		expect(typeof config.debug).toBe('boolean');
		expect(typeof config.devtools).toBe('boolean');
	});

	it('should cache config', () => {
		const config1 = getStoreConfig();
		const config2 = getStoreConfig();
		expect(config1).toBe(config2);
	});

	it('should reset config cache', () => {
		const config1 = getStoreConfig();
		resetStoreConfigCache();
		const config2 = getStoreConfig();
		expect(config1).not.toBe(config2);
		expect(config1).toEqual(config2);
	});
});
