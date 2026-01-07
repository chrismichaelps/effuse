import type { DocEntry } from './markdownParser.js';
import { tokenize, tokenizeQuery } from './tokenizer.js';

export interface IndexEntry {
	docId: string;
	positions: number[];
	frequency: number;
	field: 'title' | 'text' | 'code' | 'heading';
}

export interface InvertedIndex {
	terms: Map<string, IndexEntry[]>;
	docCount: number;
	docs: Map<string, DocEntry>;
	avgDocLength: number;
}

export interface SearchMatch {
	docId: string;
	score: number;
	matchedTerms: string[];
	bestField: 'title' | 'text' | 'code' | 'heading';
}

const K1 = 1.2;
const B = 0.75;

const FIELD_WEIGHTS = {
	title: 10.0,
	heading: 5.0,
	code: 2.0,
	text: 1.0,
};

const EXACT_TITLE_BONUS = 100;
const TITLE_CONTAINS_BONUS = 50;
const EXACT_HEADING_BONUS = 30;

const indexField = (
	index: InvertedIndex,
	docId: string,
	content: string,
	field: 'title' | 'text' | 'code' | 'heading'
): number => {
	const tokens = tokenize(content, field === 'code');

	const termFreq = new Map<string, number[]>();
	for (const token of tokens) {
		const positions = termFreq.get(token.term) ?? [];
		positions.push(token.position);
		termFreq.set(token.term, positions);
	}

	for (const [term, positions] of termFreq) {
		const entries = index.terms.get(term) ?? [];
		entries.push({
			docId,
			positions,
			frequency: positions.length,
			field,
		});
		index.terms.set(term, entries);
	}

	return tokens.length;
};

export const buildIndex = (docs: readonly DocEntry[]): InvertedIndex => {
	const index: InvertedIndex = {
		terms: new Map(),
		docCount: docs.length,
		docs: new Map(),
		avgDocLength: 0,
	};

	let totalLength = 0;

	for (const doc of docs) {
		index.docs.set(doc.id, doc);

		totalLength += indexField(index, doc.id, doc.title, 'title');
		totalLength += indexField(index, doc.id, doc.text, 'text');
		totalLength += indexField(index, doc.id, doc.codeContent, 'code');

		for (const heading of doc.headings) {
			totalLength += indexField(index, doc.id, heading.text, 'heading');
		}
	}

	index.avgDocLength = docs.length > 0 ? totalLength / docs.length : 0;

	return index;
};

const calculateBM25 = (
	termFreq: number,
	docFreq: number,
	totalDocs: number,
	docLength: number,
	avgDocLength: number
): number => {
	const idf = Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);
	const tf =
		(termFreq * (K1 + 1)) /
		(termFreq + K1 * (1 - B + B * (docLength / avgDocLength)));
	return idf * tf;
};

const normalize = (str: string): string =>
	str
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');

const checkTitleMatch = (title: string, query: string): number => {
	const lowerTitle = normalize(title);
	const lowerQuery = normalize(query).trim();

	if (lowerTitle === lowerQuery) return EXACT_TITLE_BONUS;

	if (lowerTitle.startsWith(lowerQuery)) return TITLE_CONTAINS_BONUS * 1.5;

	const wordBoundaryRegex = new RegExp(
		`\\b${lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
	);
	if (wordBoundaryRegex.test(lowerTitle)) return TITLE_CONTAINS_BONUS;

	if (lowerTitle.includes(lowerQuery)) return TITLE_CONTAINS_BONUS * 0.7;

	return 0;
};

const checkHeadingMatch = (
	headings: { text: string }[],
	query: string
): number => {
	const lowerQuery = normalize(query).trim();

	for (const heading of headings) {
		const lowerHeading = normalize(heading.text);
		if (lowerHeading === lowerQuery) return EXACT_HEADING_BONUS;
		if (lowerHeading.includes(lowerQuery)) return EXACT_HEADING_BONUS * 0.5;
	}

	return 0;
};

export const searchIndex = (
	index: InvertedIndex,
	query: string,
	maxResults = 10
): SearchMatch[] => {
	const queryTerms = tokenizeQuery(query);
	if (queryTerms.length === 0) return [];

	const docScores = new Map<
		string,
		{
			bm25Score: number;
			matchedTerms: Set<string>;
			fieldScores: Map<string, number>;
			titleBonus: number;
			headingBonus: number;
		}
	>();

	for (const term of queryTerms) {
		const entries = index.terms.get(term);
		if (!entries) continue;

		const docFreq = entries.length;

		for (const entry of entries) {
			const doc = index.docs.get(entry.docId);
			if (!doc) continue;

			const docLength =
				doc.title.length + doc.text.length + doc.codeContent.length;
			const bm25 = calculateBM25(
				entry.frequency,
				docFreq,
				index.docCount,
				docLength,
				index.avgDocLength
			);
			const fieldWeight = FIELD_WEIGHTS[entry.field];
			const termScore = bm25 * fieldWeight;

			const existing = docScores.get(entry.docId) ?? {
				bm25Score: 0,
				matchedTerms: new Set<string>(),
				fieldScores: new Map<string, number>(),
				titleBonus: 0,
				headingBonus: 0,
			};

			existing.bm25Score += termScore;
			existing.matchedTerms.add(term);

			const currentFieldScore = existing.fieldScores.get(entry.field) ?? 0;
			existing.fieldScores.set(entry.field, currentFieldScore + termScore);

			docScores.set(entry.docId, existing);
		}
	}

	for (const [docId, data] of docScores) {
		const doc = index.docs.get(docId);
		if (!doc) continue;

		data.titleBonus = checkTitleMatch(doc.title, query);
		data.headingBonus = checkHeadingMatch(doc.headings, query);
	}

	const results: SearchMatch[] = [];

	for (const [docId, data] of docScores) {
		const coverage = data.matchedTerms.size / queryTerms.length;

		const finalScore =
			data.titleBonus + data.headingBonus + data.bm25Score * coverage;

		let bestField: 'title' | 'text' | 'code' | 'heading' = 'text';
		let bestFieldScore = 0;

		if (data.titleBonus > 0) {
			bestField = 'title';
			bestFieldScore = data.titleBonus;
		} else if (data.headingBonus > 0) {
			bestField = 'heading';
			bestFieldScore = data.headingBonus;
		} else {
			for (const [field, score] of data.fieldScores) {
				if (score > bestFieldScore) {
					bestFieldScore = score;
					bestField = field as typeof bestField;
				}
			}
		}

		results.push({
			docId,
			score: finalScore,
			matchedTerms: [...data.matchedTerms],
			bestField,
		});
	}

	results.sort((a, b) => b.score - a.score);

	return results.slice(0, maxResults);
};

export const getDoc = (
	index: InvertedIndex,
	docId: string
): DocEntry | undefined => index.docs.get(docId);
