export interface Token {
	term: string;
	position: number;
	type: 'word' | 'code' | 'ngram';
}

const normalize = (str: string): string =>
	str
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');

const splitCamelCase = (str: string): string[] => {
	return str
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.toLowerCase()
		.split(/\s+/)
		.filter((s) => s.length > 1);
};

const splitSnakeCase = (str: string): string[] => {
	return str
		.toLowerCase()
		.split(/[_-]+/)
		.filter((s) => s.length > 1);
};

const extractCodeIdentifiers = (text: string): string[] => {
	const identifiers: string[] = [];

	const patterns = [
		/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
		/\b(use[A-Z][a-zA-Z0-9]*)\b/g,
		/\b(create[A-Z][a-zA-Z0-9]*)\b/g,
		/\b(define[A-Z][a-zA-Z0-9]*)\b/g,
		/\b([A-Z][a-zA-Z0-9]+)\b/g,
		/['"`]([a-zA-Z][a-zA-Z0-9_-]*)['"`]/g,
	];

	for (const pattern of patterns) {
		let match;
		while ((match = pattern.exec(text)) !== null) {
			const id = match[1];
			if (id && id.length > 1) {
				identifiers.push(id.toLowerCase());
			}
		}
	}

	return [...new Set(identifiers)];
};

const generateNgrams = (str: string, minLen = 3, maxLen = 8): string[] => {
	const ngrams: string[] = [];
	const lower = str.toLowerCase();

	for (let len = minLen; len <= Math.min(maxLen, lower.length); len++) {
		for (let i = 0; i <= lower.length - len; i++) {
			ngrams.push(lower.slice(i, i + len));
		}
	}

	return ngrams;
};

export const tokenize = (text: string, includeNgrams = false): Token[] => {
	const tokens: Token[] = [];
	let position = 0;

	const normalizedText = normalize(text);
	const words = normalizedText
		.replace(/[^\w\s'-]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 1);

	for (const word of words) {
		const term = normalize(word);
		tokens.push({ term, position: position++, type: 'word' });

		if (/[A-Z]/.test(text)) {
			for (const part of splitCamelCase(word)) {
				tokens.push({ term: part, position: position++, type: 'word' });
			}
		}

		if (word.includes('_') || word.includes('-')) {
			for (const part of splitSnakeCase(word)) {
				tokens.push({ term: part, position: position++, type: 'word' });
			}
		}
	}

	const codeIds = extractCodeIdentifiers(text);
	for (const id of codeIds) {
		tokens.push({ term: id, position: position++, type: 'code' });

		for (const part of splitCamelCase(id)) {
			if (!tokens.some((t) => t.term === part)) {
				tokens.push({ term: part, position: position++, type: 'code' });
			}
		}
	}

	if (includeNgrams) {
		const fullText = text.toLowerCase().replace(/[^\w]/g, '');
		for (const ngram of generateNgrams(fullText, 3, 6)) {
			tokens.push({ term: ngram, position: position++, type: 'ngram' });
		}
	}

	const seen = new Set<string>();
	return tokens.filter((t) => {
		if (seen.has(t.term)) return false;
		seen.add(t.term);
		return true;
	});
};

export const tokenizeQuery = (query: string): string[] => {
	const terms: string[] = [];

	const cleaned = normalize(query).replace(/['"()[\]{}]/g, ' ');
	const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
	terms.push(...words);

	const codeIds = extractCodeIdentifiers(query);
	terms.push(...codeIds);

	for (const word of words) {
		terms.push(...splitCamelCase(word));
		terms.push(...splitSnakeCase(word));
	}

	return [...new Set(terms)];
};
