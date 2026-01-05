export interface DocHeading {
	text: string;
	id: string;
	level: number;
}

export interface DocEntry {
	id: string;
	title: string;
	text: string;
	codeContent: string;
	path: string;
	headings: DocHeading[];
}

const extractTitle = (content: string, fileName: string): string => {
	const h1Match = content.match(/^#\s+(.+)$/m);
	if (h1Match) return h1Match[1].trim();

	const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/m);
	if (frontmatterMatch) {
		const frontmatter = frontmatterMatch[1];
		const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
		if (titleMatch) return titleMatch[1].trim();
	}

	return fileName
		.replace(/.md$/, '')
		.replace(/[-_]/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
};

const extractHeadings = (content: string): DocHeading[] => {
	const headings: DocHeading[] = [];
	const headingRegex = /^(#{1,6})\s+(.+)$/gm;
	let match;

	while ((match = headingRegex.exec(content)) !== null) {
		const level = match[1].length;
		let text = match[2].trim();
		text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_~]+/g, '');

		const id = text
			.toLowerCase()
			.replace(/[^\w\s-]/g, '') // Remove special chars
			.replace(/\s+/g, '-')
			.replace(/^-+|-+$/g, '')
			.replace(/-{2,}/g, '-');

		const baseId = id || `section-${headings.length + 1}`;
		let uniqueId = baseId;
		let counter = 1;
		while (headings.some((h) => h.id === uniqueId)) {
			uniqueId = `${baseId}-${++counter}`;
		}

		headings.push({ text, id: uniqueId, level });
	}

	return headings;
};

const extractCodeContent = (content: string): string => {
	const codeBlocks: string[] = [];

	const fencedRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
	let match;
	while ((match = fencedRegex.exec(content)) !== null) {
		const code = match[1].trim();
		if (code) codeBlocks.push(code);
	}

	const indentedRegex = /^( {4}|\t)([\s\S]*?)(?=\n[^ \t])/gm;
	while ((match = indentedRegex.exec(content)) !== null) {
		const code = match[2].replace(/^( {4}|\t)/gm, '').trim();
		if (code) codeBlocks.push(code);
	}

	const inlineRegex = /`([^`\n]{4,})`/g;
	while ((match = inlineRegex.exec(content)) !== null) {
		codeBlocks.push(match[1].trim());
	}

	return codeBlocks.join('\n\n').slice(0, 4000);
};

const extractPlainText = (content: string): string => {
	let cleaned = content;

	// Remove frontmatter
	cleaned = cleaned.replace(/^---[\s\S]*?---\n?/, '');

	// Remove HTML tags
	cleaned = cleaned.replace(/<[^>]+>/g, ' ');

	// Remove images ![alt](url)
	cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1 ');

	// Remove links, keep text [text](url)
	cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1 ');

	// Remove code blocks
	cleaned = cleaned.replace(/```[\s\S]*?```/g, ' ');
	cleaned = cleaned.replace(/^( {4}|\t)[\s\S]*?(?=\n[^ \t])/gm, ' ');

	// Remove inline code
	cleaned = cleaned.replace(/`[^`]+`/g, ' ');

	// Remove tables
	cleaned = cleaned.replace(/^\|.*\|$/gm, ' ');
	cleaned = cleaned.replace(/^[ -|]+$/gm, ' ');

	// Remove lists prefixes
	cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, ' ');
	cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, ' ');

	// Remove blockquotes
	cleaned = cleaned.replace(/^\s*>+\s?/gm, ' ');

	// Remove emphasis markdown
	cleaned = cleaned.replace(/[*_~`]+/g, ' ');

	// Remove horizontal rules
	cleaned = cleaned.replace(/^\s*[-*_]{3,}\s*$/gm, ' ');

	// Normalize whitespace
	cleaned = cleaned.replace(/\s+/g, ' ').trim();

	return cleaned.slice(0, 3000);
};

export const parseMarkdownContent = (
	filePath: string,
	content: string,
	lang: string = 'en'
): DocEntry | null => {
	const fileName = filePath.split('/').pop()?.replace(/\.md$/, '') ?? '';
	if (!fileName) return null;

	const title = extractTitle(content, fileName);
	const headings = extractHeadings(content);
	const text = extractPlainText(content);
	const codeContent = extractCodeContent(content);

	if (!title && !text && !codeContent && headings.length === 0) return null;

	return {
		id: fileName,
		title,
		text,
		codeContent,
		path: `${lang}/${fileName}.md`,
		headings,
	};
};
