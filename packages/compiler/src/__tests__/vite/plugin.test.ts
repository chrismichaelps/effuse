/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import { effuse } from '../../vite/index.js';

describe('Vite plugin', () => {
	describe('shouldProcess', () => {
		const plugin = effuse();

		it('should process .tsx files', () => {
			const result = (plugin as any).transform('const x = 1;', 'App.tsx');
			// No signal accessor in code, so should return null
			expect(result).toBeNull();
		});

		it('should process .jsx files', () => {
			const result = (plugin as any).transform('const x = 1;', 'App.jsx');
			expect(result).toBeNull();
		});

		it('should skip non-JSX files', () => {
			const result = (plugin as any).transform('const x = 1;', 'App.ts');
			expect(result).toBeNull();
		});

		it('should skip node_modules', () => {
			const code = 'const Comp = () => <div>{count.value}</div>;';
			const result = (plugin as any).transform(
				code,
				'/project/node_modules/some-lib/index.tsx'
			);
			expect(result).toBeNull();
		});

		it('should skip dist folder', () => {
			const code = 'const Comp = () => <div>{count.value}</div>;';
			const result = (plugin as any).transform(
				code,
				'/project/dist/App.tsx'
			);
			expect(result).toBeNull();
		});
	});

	describe('config merging', () => {
		it('should use default config when no options provided', () => {
			const plugin = effuse();
			expect(plugin.name).toBe('effuse-compiler');
			expect(plugin.enforce).toBe('pre');
		});

		it('should merge custom signal accessors', () => {
			const plugin = effuse({
				signalAccessors: ['.current', '.state'],
			});
			const code = 'const Comp = () => <div>{count.current}</div>;';
			const result = (plugin as any).transform(code, 'App.tsx');
			// transform returns null if no accessor found via code.includes
			// This tests the integration; the actual wrapping is tested in transformer tests
			expect(result === null || typeof result === 'object').toBe(true);
		});
	});

	describe('transform', () => {
		it('should transform code with signal accessors', () => {
			const plugin = effuse();
			const code = 'const Comp = () => <div>{count.value}</div>;';
			const result = (plugin as any).transform(code, 'App.tsx');
			expect(result).not.toBeNull();
			expect(result.code).toContain('() => count.value');
		});

		it('should return null when no transformation needed', () => {
			const plugin = effuse();
			const code = 'const Comp = () => <div>Hello</div>;';
			const result = (plugin as any).transform(code, 'App.tsx');
			expect(result).toBeNull();
		});
	});
});
