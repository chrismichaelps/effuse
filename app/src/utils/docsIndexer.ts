import { parseMarkdownContent, type DocEntry } from './markdownParser.js';

const allMarkdownModules = import.meta.glob('../content/docs/*/*.md', {
	query: '?raw',
	import: 'default',
	eager: false,
}) as Record<string, () => Promise<string>>;

export const loadDocsIndex = async (lang: string): Promise<DocEntry[]> => {
	const entries: DocEntry[] = [];

	const langModules = Object.entries(allMarkdownModules).filter(([path]) =>
		path.includes(`/docs/${lang}/`)
	);

	for (const [filePath, loadModule] of langModules) {
		try {
			const content = await loadModule();
			const entry = parseMarkdownContent(filePath, content, lang);
			if (entry) {
				entries.push(entry);
			}
		} catch {
			/* */
		}
	}

	return entries;
};

export type { DocEntry };
