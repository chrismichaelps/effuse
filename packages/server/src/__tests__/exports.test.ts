/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import * as pkg from '../index.js';
import * as bunSubpath from '../bun/index.js';
import * as nodeSubpath from '../node/index.js';

describe('@effuse/server public conversion helpers', () => {
	it('exposes toWebRequest and writeWebResponse from the package root', () => {
		expect(typeof pkg.toWebRequest).toBe('function');
		expect(typeof pkg.writeWebResponse).toBe('function');
	});

	it('exposes the same conversion helpers from the ./node subpath', () => {
		expect(typeof nodeSubpath.toWebRequest).toBe('function');
		expect(typeof nodeSubpath.writeWebResponse).toBe('function');
		// Both entry points must resolve to one implementation so dev and
		// production share a single request/response conversion.
		expect(nodeSubpath.toWebRequest).toBe(pkg.toWebRequest);
		expect(nodeSubpath.writeWebResponse).toBe(pkg.writeWebResponse);
	});

	it('exposes static file serving from both runtime subpaths', () => {
		expect(typeof nodeSubpath.withStaticFiles).toBe('function');
		expect(bunSubpath.withStaticFiles).toBe(nodeSubpath.withStaticFiles);
		expect(pkg.withStaticFiles).toBe(nodeSubpath.withStaticFiles);
	});
});
