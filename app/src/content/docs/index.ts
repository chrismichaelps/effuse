interface DocEntry {
	title: string;
	content: string;
}

const parseFrontmatter = (
	markdown: string
): { title: string; content: string } => {
	const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
	const match = markdown.match(frontmatterRegex);
	if (match) {
		const frontmatter = match[1];
		const content = match[2].trim();
		const titleMatch = frontmatter.match(/title:\s*(.+)/);
		const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
		return { title, content };
	}
	const h1Match = markdown.match(/^#\s+(.+)$/m);
	const title = h1Match ? h1Match[1].trim() : 'Untitled';
	return { title, content: markdown };
};

const markdownModules = import.meta.glob('./md/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;
const buildDocsRegistry = (): Record<string, DocEntry> => {
	const registry: Record<string, DocEntry> = {};
	for (const [path, content] of Object.entries(markdownModules)) {
		const slug = path.replace('./md/', '').replace('.md', '');
		const { title, content: docContent } = parseFrontmatter(content);
		registry[slug] = { title, content: docContent };
	}
	return registry;
};

export const docsRegistry = buildDocsRegistry();

export const docSlugs = Object.keys(docsRegistry);

export const getDoc = (slug: string): DocEntry => {
	return docsRegistry[slug] ?? docsRegistry['getting-started'];
};
