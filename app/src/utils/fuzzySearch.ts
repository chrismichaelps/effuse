export interface FuzzyMatchResult {
	score: number;
	indices?: number[];
}

const levenshteinSimilarity = (str1: string, str2: string): number => {
	const len1 = str1.length;
	const len2 = str2.length;
	if (len1 === 0) return len2 === 0 ? 1 : 0;
	if (len2 === 0) return 0;

	let matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

	for (let i = 0; i <= len1; i++) matrix[i][0] = i;
	for (let j = 0; j <= len2; j++) matrix[0][j] = j;

	for (let i = 1; i <= len1; i++) {
		for (let j = 1; j <= len2; j++) {
			const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1, // Deletion
				matrix[i][j - 1] + 1, // Insertion
				matrix[i - 1][j - 1] + cost // Substitution
			);
		}
	}

	const distance = matrix[len1][len2];
	return 1 - distance / Math.max(len1, len2);
};

const fuzzyMatchSingle = (text: string, pattern: string): FuzzyMatchResult => {
	if (!pattern) return { score: 0 };

	const lowerText = text.toLowerCase();
	const lowerPattern = pattern.toLowerCase();

	const exactIndex = lowerText.indexOf(lowerPattern);
	if (exactIndex !== -1) {
		return {
			score: 1.0,
			indices: Array.from({ length: pattern.length }, (_, i) => exactIndex + i),
		};
	}

	if (lowerText.startsWith(lowerPattern)) {
		return {
			score: 0.95,
			indices: Array.from({ length: pattern.length }, (_, i) => i),
		};
	}

	let i = 0;
	let j = 0;
	const indices: number[] = [];
	let consecutive = 0;
	let maxConsecutive = 0;
	let firstMatchIndex = -1;

	while (i < lowerText.length && j < lowerPattern.length) {
		if (lowerText[i] === lowerPattern[j]) {
			if (firstMatchIndex === -1) firstMatchIndex = i;
			indices.push(i);
			consecutive++;
			maxConsecutive = Math.max(maxConsecutive, consecutive);
			j++;
		} else {
			consecutive = 0;
		}
		i++;
	}

	let seqScore = 0;
	if (j === lowerPattern.length) {
		const matchLength = i - firstMatchIndex;
		const density = pattern.length / matchLength;
		const consecBonus = maxConsecutive / pattern.length;
		seqScore = density * 0.5 + consecBonus * 0.3 + 0.1;
		seqScore = Math.min(0.9, seqScore);
	}

	const levSim = levenshteinSimilarity(lowerText, lowerPattern);

	const combinedScore = Math.max(seqScore, levSim * 0.8 + seqScore * 0.2);

	return {
		score: combinedScore,
		indices: indices.length > 0 ? indices : undefined,
	};
};

export const calculateScore = (
	text: string,
	query: string
): FuzzyMatchResult => {
	const normalizedText = text.toLowerCase();
	const normalizedQuery = query.trim().toLowerCase();

	if (!normalizedQuery) return { score: 0 };

	const exactIndex = normalizedText.indexOf(normalizedQuery);
	if (exactIndex !== -1) {
		return {
			score: 1.0,
			indices: Array.from({ length: query.length }, (_, i) => exactIndex + i),
		};
	}

	const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);

	if (words.length === 0) return { score: 0 };

	const matches = words.map((word) => fuzzyMatchSingle(text, word));

	const goodMatches = matches.filter((m) => m.score > 0.3);
	if (goodMatches.length === 0) return { score: 0 };

	const wordCoverage = goodMatches.length / words.length;
	const avgMatchScore =
		goodMatches.reduce((sum, m) => sum + m.score, 0) / goodMatches.length;

	const sortedMatches = goodMatches
		.map((m, idx) => ({ ...m, originalIdx: idx }))
		.filter((m) => m.indices?.[0] !== undefined)
		.sort((a, b) => (a.indices?.[0] ?? 0) - (b.indices?.[0] ?? 0));

	let orderBonus = 0;
	if (sortedMatches.length > 1) {
		const appearedOrder = sortedMatches.map((m) => m.originalIdx);
		const isOrdered = appearedOrder.every(
			(val, idx) => idx === 0 || val > appearedOrder[idx - 1]
		);
		if (isOrdered) orderBonus = 0.2;
	}

	const finalScore = Math.min(
		1.0,
		wordCoverage * 0.4 + avgMatchScore * 0.4 + orderBonus * 0.2
	);

	const earliestIndex =
		Math.min(...goodMatches.map((m) => m.indices?.[0] ?? Infinity)) || -1;

	return {
		score: finalScore,
		indices: earliestIndex !== Infinity ? [earliestIndex] : undefined,
	};
};

export const isCodeQuery = (query: string): boolean => {
	if (!query) return false;

	const codePatterns = [
		/[()[\]{}]/, // Brackets
		/\./, // Dot notation
		/=>|\->/, // Arrows
		/["'`].*["'`]/, // Strings
		/\b(function|const|let|var|class|interface|type|export|import|async|await|return|if|else|for|while|switch)\b/i, // Keywords
		/[A-Z][a-z]*[A-Z]/, // Camel/Pascal case
		/\b\w+[\.:]\w+\b/, // Qualified names
		/[=+\-*/%<>!&|?]/, // Operators
	];

	return codePatterns.some((regex) => regex.test(query));
};
