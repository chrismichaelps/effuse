export const normalizeDOMAttributeName = (key: string): string => {
	if (key === 'className') return 'class';
	if (key === 'htmlFor') return 'for';
	return key;
};
