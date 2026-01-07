import type { DocEntry } from './markdownParser.js';
import {
	buildIndex,
	searchIndex,
	getDoc,
	type InvertedIndex,
	type SearchMatch,
} from './invertedIndex.js';

export interface SearchResultItem {
	id: string;
	documentId: string;
	text: string;
	score: number;
	heading?: string;
	filePath?: string;
	anchor?: string;
	matchedIn?: 'title' | 'content' | 'code' | 'heading';
}

interface SearchEngineConfig {
	maxResults: number;
	snippetLength: number;
	snippetContext: number;
}

const DEFAULT_CONFIG: SearchEngineConfig = {
	maxResults: 10,
	snippetLength: 150,
	snippetContext: 60,
};

const createSnippet = (
	text: string,
	matchedTerms: string[],
	config: SearchEngineConfig
): string => {
	if (!text) return '';

	const lower = text.toLowerCase();
	let bestIndex = -1;

	for (const term of matchedTerms) {
		const idx = lower.indexOf(term.toLowerCase());
		if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
			bestIndex = idx;
		}
	}

	if (bestIndex === -1) {
		return (
			text.slice(0, config.snippetLength) +
			(text.length > config.snippetLength ? '...' : '')
		);
	}

	const start = Math.max(0, bestIndex - config.snippetContext);
	const end = Math.min(text.length, bestIndex + config.snippetLength);

	return (
		(start > 0 ? '...' : '') +
		text.slice(start, end) +
		(end < text.length ? '...' : '')
	);
};

const getTextForField = (doc: DocEntry, field: string): string => {
	switch (field) {
		case 'title':
			return doc.title;
		case 'code':
			return doc.codeContent;
		case 'heading':
			return doc.headings.map((h) => h.text).join(' ');
		default:
			return doc.text;
	}
};

const getAnchorForDoc = (
	doc: DocEntry,
	matchedTerms: string[]
): string | undefined => {
	const lower = matchedTerms.map((t) => t.toLowerCase());

	for (const heading of doc.headings) {
		const headingLower = heading.text.toLowerCase();
		if (lower.some((term) => headingLower.includes(term))) {
			return heading.id;
		}
	}

	return doc.headings[0]?.id;
};

const convertMatch = (
	match: SearchMatch,
	doc: DocEntry,
	config: SearchEngineConfig
): SearchResultItem => {
	const fieldText = getTextForField(doc, match.bestField);
	const matchedIn =
		match.bestField === 'heading'
			? 'heading'
			: match.bestField === 'code'
				? 'code'
				: match.bestField === 'title'
					? 'title'
					: 'content';

	return {
		id: `${doc.id}-${matchedIn}`,
		documentId: doc.id,
		text: createSnippet(fieldText, match.matchedTerms, config),
		score: Math.min(1, match.score / 10),
		heading: doc.title,
		filePath: doc.path,
		anchor: getAnchorForDoc(doc, match.matchedTerms),
		matchedIn,
	};
};

export interface SearchEngine {
	index: InvertedIndex;
	search: (query: string) => SearchResultItem[];
	reindex: (docs: readonly DocEntry[]) => void;
}

export const createSearchEngine = (
	initialDocs: readonly DocEntry[] = [],
	customConfig?: Partial<SearchEngineConfig>
): SearchEngine => {
	const config = { ...DEFAULT_CONFIG, ...customConfig };
	let index = buildIndex(initialDocs);

	return {
		get index() {
			return index;
		},

		search(query: string): SearchResultItem[] {
			if (!query || query.trim().length < 2) return [];

			const matches = searchIndex(index, query.trim(), config.maxResults);

			return matches
				.map((match) => {
					const doc = getDoc(index, match.docId);
					if (!doc) return null;
					return convertMatch(match, doc, config);
				})
				.filter((r): r is SearchResultItem => r !== null);
		},

		reindex(docs: readonly DocEntry[]): void {
			index = buildIndex(docs);
		},
	};
};

let defaultEngine: SearchEngine | null = null;

export const searchDocs = (
	docs: readonly DocEntry[],
	query: string
): SearchResultItem[] => {
	if (!defaultEngine || defaultEngine.index.docCount !== docs.length) {
		defaultEngine = createSearchEngine(docs);
	}
	return defaultEngine.search(query);
};
