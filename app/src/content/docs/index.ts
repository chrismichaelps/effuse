import { computed, type ReadonlySignal } from '@effuse/core';
import { i18nStore } from '../../store/appI18n';

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

const allMarkdownModules = import.meta.glob('./*/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

const buildAllDocsRegistries = (): Record<string, Record<string, DocEntry>> => {
	const registries: Record<string, Record<string, DocEntry>> = {};

	for (const [path, content] of Object.entries(allMarkdownModules)) {
		const match = path.match(/^\.\/([^/]+)\/(.+)\.md$/);
		if (!match) continue;

		const locale = match[1];
		const slug = match[2];

		if (!registries[locale]) {
			registries[locale] = {};
		}

		const { title, content: docContent } = parseFrontmatter(content);
		registries[locale][slug] = { title, content: docContent };
	}

	return registries;
};

const docsRegistryByLocale = buildAllDocsRegistries();
const fallbackRegistry = docsRegistryByLocale['en'] ?? {};

export const currentDocsRegistry: ReadonlySignal<Record<string, DocEntry>> =
	computed(() => {
		const locale = i18nStore.locale.value;
		return docsRegistryByLocale[locale] ?? fallbackRegistry;
	});

export const docsRegistry = fallbackRegistry;
