/**
 * Deep equality comparison for cache values.
 *
 * Handles primitives, Date, RegExp, arrays, plain objects, Maps, and Sets.
 * Does NOT handle circular references (assumes query data is acyclic).
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
	if (Object.is(a, b)) return true;

	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	if (a instanceof RegExp && b instanceof RegExp) {
		return a.source === b.source && a.flags === b.flags;
	}

	if (a instanceof Map && b instanceof Map) {
		if (a.size !== b.size) return false;
		for (const [key, value] of a) {
			if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
		}
		return true;
	}

	if (a instanceof Set && b instanceof Set) {
		if (a.size !== b.size) return false;
		const bArr = Array.from(b);
		for (const item of a) {
			if (!bArr.some((bItem) => deepEqual(item, bItem))) return false;
		}
		return true;
	}

	if (
		typeof a !== 'object' ||
		a === null ||
		typeof b !== 'object' ||
		b === null
	) {
		return false;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}

	if (Array.isArray(a) !== Array.isArray(b)) return false;

	const aObj = a as Record<string, unknown>;
	const bObj = b as Record<string, unknown>;

	const aKeys = Object.keys(aObj);
	const bKeys = Object.keys(bObj);

	if (aKeys.length !== bKeys.length) return false;

	for (const key of aKeys) {
		if (!Object.hasOwn(bObj, key)) return false;
		if (!deepEqual(aObj[key], bObj[key])) return false;
	}

	return true;
};
