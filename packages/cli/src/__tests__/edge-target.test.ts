/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import { PRESETS } from '../constants.js';

describe('server build target per preset', () => {
	const getServerTarget = (preset: string): string => {
		return preset === PRESETS.CLOUDFLARE || preset === PRESETS.VERCEL
			? 'webworker'
			: 'es2022';
	};

	it('should use webworker target for Cloudflare preset', () => {
		expect(getServerTarget(PRESETS.CLOUDFLARE)).toBe('webworker');
	});

	it('should use webworker target for Vercel preset', () => {
		expect(getServerTarget(PRESETS.VERCEL)).toBe('webworker');
	});

	it('should use es2022 target for Node preset', () => {
		expect(getServerTarget(PRESETS.NODE)).toBe('es2022');
	});

	it('should use es2022 target for Netlify preset', () => {
		expect(getServerTarget(PRESETS.NETLIFY)).toBe('es2022');
	});
});
