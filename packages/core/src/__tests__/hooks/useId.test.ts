import { describe, it, expect } from 'vitest';
import { captureIdScope, runWithIdScope, useId } from '../../hooks/useId.js';

describe('useId', () => {
	it('should return unique ids on successive calls', () => {
		const a = useId();
		const b = useId();
		const c = useId();

		expect(a).not.toBe(b);
		expect(b).not.toBe(c);
		expect(a).not.toBe(c);
	});

	it('should return stable ids with the effuse prefix', () => {
		const id = useId();
		expect(id).toMatch(/^:e\d+$/);
	});

	it('should increment counter monotonically', () => {
		const id1 = useId();
		const id2 = useId();

		const num1 = Number(id1.replace(':e', ''));
		const num2 = Number(id2.replace(':e', ''));

		expect(num2).toBe(num1 + 1);
	});

	it('carries a render sequence into work that runs after its scope returns', () => {
		let deferredId: (() => string) | undefined;

		runWithIdScope(() => {
			expect(useId()).toBe(':e1');
			const runWithCapturedScope = captureIdScope();
			deferredId = () => runWithCapturedScope(useId);
		});

		expect(deferredId?.()).toBe(':e2');
	});
});
