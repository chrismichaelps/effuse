export type DOMNamespace = 'html' | 'svg' | 'mathml';

export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg';
export const MATHML_NAMESPACE_URI = 'http://www.w3.org/1998/Math/MathML';

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
	if (namespaceURI === SVG_NAMESPACE_URI) return 'svg';
	if (namespaceURI === MATHML_NAMESPACE_URI) return 'mathml';
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

export const createDOMElement = (
	ownerDocument: Document,
	tag: string,
	namespace: DOMNamespace
): Element => {
	if (namespace === 'html') return ownerDocument.createElement(tag);
	return ownerDocument.createElementNS(
		namespace === 'svg' ? SVG_NAMESPACE_URI : MATHML_NAMESPACE_URI,
		tag
	);
};

/**
 * Props that never reach the DOM in any form.
 *
 * The server serializer and the client binder both consult this, for the same
 * reason they share `normalizeDOMAttributeName`: each previously kept its own
 * list and the two drifted, so `key` shipped as a server attribute while
 * `_`-prefixed props leaked into client markup.
 *
 * Refs, `use:` directives, and `on*` handlers are deliberately absent. They are
 * not attributes either, but each side does something different with them, so
 * they stay where that routing lives.
 */
export const isInternalProp = (key: string): boolean =>
	key === 'children' || key === 'key' || key.startsWith('_');
