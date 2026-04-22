/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import { transformSync } from '../transformer/index.js';
import { defaultConfig } from '../config/index.js';

describe('transformer', () => {
	describe('signal wrapping', () => {
		it('should wrap JSX expression with signal access', () => {
			const code = `const Comp = () => <div>{count.value}</div>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(true);
			expect(result.code).toContain('() => count.value');
		});

		it('should wrap nested signal access', () => {
			const code = `const Comp = () => <div>{user.name.value}</div>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(true);
			expect(result.code).toContain('() => user.name.value');
		});

		it('should wrap signal in template literal', () => {
			const code = 'const Comp = () => <div>{`Hello ${name.value}`}</div>;';
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(true);
			expect(result.code).toContain('() => `Hello ${name.value}`');
		});

		it('should wrap signal in conditional expression', () => {
			const code = `const Comp = () => <div>{show.value ? 'yes' : 'no'}</div>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(true);
			expect(result.code).toContain('() => show.value ?');
		});

		it('should wrap signal in binary expression', () => {
			const code = `const Comp = () => <div>{count.value + 1}</div>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(true);
			expect(result.code).toContain('() => count.value + 1');
		});

		it('should wrap signal in JSX attribute', () => {
			const code = `const Comp = () => <input value={text.value} />;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(true);
			expect(result.code).toContain('() => text.value');
		});

		it('should not wrap when autoUnwrap is disabled', () => {
			const code = `const Comp = () => <div>{count.value}</div>;`;
			const result = transformSync(code, 'test.tsx', {
				...defaultConfig,
				autoUnwrap: false,
			});
			expect(result.transformed).toBe(false);
			expect(result.code).not.toContain('() => count.value');
		});

		it('should not wrap props when autoUnwrapProps is disabled', () => {
			const code = `const Comp = () => <input value={text.value} />;`;
			const result = transformSync(code, 'test.tsx', {
				...defaultConfig,
				autoUnwrapProps: false,
			});
			expect(result.transformed).toBe(false);
		});

		it('should not wrap already wrapped expressions', () => {
			const code = `const Comp = () => <div>{() => count.value}</div>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(false);
		});

		it('should not wrap assignment expressions', () => {
			const code = `const Comp = () => <div>{count.value = 1}</div>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(false);
		});

		it('should not wrap event handler attributes', () => {
			const code = `const Comp = () => <button onClick={() => count.value++}>Click</button>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			// The onClick attribute value is an arrow function (already wrapped),
			// so it should not be wrapped again
			expect(result.transformed).toBe(false);
		});

		it('should not transform files without signal accessors', () => {
			const code = `const Comp = () => <div>Hello</div>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(false);
		});

		it('should track stats correctly', () => {
			const code = `
				const Comp = () => (
					<div>
						{count.value}
						<input value={text.value} />
					</div>
				);
			`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(true);
			expect(result.stats.expressionsWrapped).toBe(1);
			expect(result.stats.propsWrapped).toBe(1);
			expect(result.stats.skipped).toBe(0);
		});
	});

	describe('TypeScript support', () => {
		it('should handle TSX files', () => {
			const code = `const Comp = (props: { count: Signal<number> }) => <div>{props.count.value}</div>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(true);
			expect(result.code).toContain('() => props.count.value');
		});

		it('should handle decorators', () => {
			const code = `
				@Component
				class Foo {
					render() {
						return <div>{count.value}</div>;
					}
				}
			`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.transformed).toBe(true);
		});
	});

	describe('source maps', () => {
		it('should generate source maps when enabled', () => {
			const code = `const Comp = () => <div>{count.value}</div>;`;
			const result = transformSync(code, 'test.tsx', {
				...defaultConfig,
				sourceMaps: true,
			});
			expect(result.map).not.toBeNull();
		});

		it('should not generate source maps when disabled', () => {
			const code = `const Comp = () => <div>{count.value}</div>;`;
			const result = transformSync(code, 'test.tsx', {
				...defaultConfig,
				sourceMaps: false,
			});
			expect(result.map).toBeNull();
		});
	});

	describe('caching', () => {
		it('should indicate uncached on first transform', () => {
			const code = `const Comp = () => <div>{count.value}</div>;`;
			const result = transformSync(code, 'test.tsx', defaultConfig);
			expect(result.cached).toBe(false);
		});
	});

	describe('error handling', () => {
		it('should handle syntax errors gracefully', () => {
			const code = `const Comp = () => <div>{count.value</div>;`;
			expect(() => transformSync(code, 'test.tsx', defaultConfig)).toThrow();
		});
	});
});
