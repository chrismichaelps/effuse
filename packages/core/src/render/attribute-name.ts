export type DOMNamespace = 'html' | 'svg' | 'mathml';

const camelToKebab = (value: string): string =>
	value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const normalizeAlias = (key: string): string => {
	if (key === 'className') return 'class';
	if (key === 'htmlFor') return 'for';
	if (key === 'acceptCharset') return 'accept-charset';
	if (key === 'httpEquiv') return 'http-equiv';
	return key;
};

export const normalizeDOMAttributeName = (
	key: string,
	namespace: DOMNamespace = 'html'
): string => {
	const normalized = normalizeAlias(key);
	if (namespace === 'html') return normalized.toLowerCase();
	if (namespace === 'svg') {
		if (
			normalized === 'viewBox' ||
			normalized === 'preserveAspectRatio' ||
			normalized === 'pathLength'
		) {
			return normalized;
		}
	}
	return camelToKebab(normalized);
};

export const getDOMNamespace = (namespaceURI: string | null): DOMNamespace => {
	if (namespaceURI === 'http://www.w3.org/2000/svg') return 'svg';
	if (namespaceURI === 'http://www.w3.org/1998/Math/MathML') return 'mathml';
	return 'html';
};

export const getElementNamespace = (
	parent: DOMNamespace,
	tag: string
): DOMNamespace => {
	if (parent === 'html' && tag === 'svg') return 'svg';
	if (parent === 'html' && tag === 'math') return 'mathml';
	return parent;
};

export const getChildNamespace = (
	element: DOMNamespace,
	tag: string
): DOMNamespace => (element === 'svg' && tag === 'foreignObject' ? 'html' : element);
