import {
	define,
	signal,
	computed,
	effect,
	useHead,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';
import { Ink } from '@effuse/ink';
import { DocsLayout } from '../../components/docs/DocsLayout.js';
import { currentDocsRegistry, docsRegistry } from '../../content/docs';
import type { TocItem } from '../../components/docs/DocsHeader.js';

interface DocsPageExposed {
	content: ReadonlySignal<string>;
	currentSlug: Signal<string>;
	pageTitle: ReadonlySignal<string>;
	tocItems: ReadonlySignal<TocItem[]>;
}

const getSlugFromPath = (): string => {
	const path = window.location.pathname;
	const match = path.match(/\/docs\/(.+)/);
	return match ? match[1] : 'getting-started';
};

const extractTocItems = (markdown: string): TocItem[] => {
	const headingRegex = /^(#{1,3})\s+(.+)$/gm;
	const items: TocItem[] = [];
	const usedIds = new Set<string>();
	let match;
	let index = 0;

	while ((match = headingRegex.exec(markdown)) !== null) {
		const level = match[1].length;
		const title = match[2].trim();

		let id = title
			.toLowerCase()
			.replace(/\s+/g, '-') // Replace spaces with hyphens
			.replace(/[^\p{L}\p{N}\-]/gu, '') // Keep Unicode letters, numbers, hyphens
			.replace(/-+/g, '-') // Collapse multiple hyphens
			.replace(/^-|-$/g, ''); // Trim leading/trailing hyphens

		if (!id) {
			id = 'section';
		}

		const originalId = id;
		let counter = 1;
		while (usedIds.has(id)) {
			id = `${originalId}-${counter}`;
			counter++;
		}
		usedIds.add(id);

		items.push({ id, title, level });
		index++;
	}
	return items;
};

export const DocsPage = define<{}, DocsPageExposed>({
	script: ({ onMount }) => {
		const currentSlug = signal(getSlugFromPath());

		const content = computed(() => {
			const registry = currentDocsRegistry.value;
			const slug = currentSlug.value;
			const doc = registry[slug] ?? docsRegistry['getting-started'];
			return doc.content;
		});

		const pageTitle = computed(() => {
			const registry = currentDocsRegistry.value;
			const slug = currentSlug.value;
			const doc = registry[slug] ?? docsRegistry['getting-started'];
			return doc.title;
		});

		effect(() => {
			useHead({
				title: `${pageTitle.value} - Effuse Docs`,
				description: `Documentation for ${pageTitle.value} in the Effuse framework.`,
			});
		});

		const tocItems = computed(() => {
			return extractTocItems(content.value);
		});

		onMount(() => {
			const handlePopState = () => {
				currentSlug.value = getSlugFromPath();
			};
			window.addEventListener('popstate', handlePopState);
			currentSlug.value = getSlugFromPath();
			return () => {
				window.removeEventListener('popstate', handlePopState);
			};
		});
		return { content, currentSlug, pageTitle, tocItems };
	},
	template: ({ content, currentSlug, pageTitle, tocItems }) => (
		<DocsLayout
			currentPath={`/docs/${currentSlug.value}`}
			pageTitle={pageTitle.value}
			tocItems={tocItems}
		>
			<article class="prose prose-slate max-w-none">
				<Ink content={content} />
			</article>
		</DocsLayout>
	),
});
