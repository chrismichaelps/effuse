import {
	define,
	signal,
	computed,
	useHead,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';
import { Ink } from '@effuse/ink';
import { DocsLayout } from '../../components/docs/DocsLayout.js';
import { docsRegistry } from '../../content/docs';
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
	let match;
	while ((match = headingRegex.exec(markdown)) !== null) {
		const level = match[1].length;
		const title = match[2].trim();
		const id = title
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-');
		items.push({ id, title, level });
	}
	return items;
};

export const DocsPage = define<{}, DocsPageExposed>({
	script: ({ onMount }) => {
		const currentSlug = signal(getSlugFromPath());
		const content = computed(() => {
			const slug = currentSlug.value;
			return (
				docsRegistry[slug]?.content ?? docsRegistry['getting-started'].content
			);
		});

		const pageTitle = computed(() => {
			const slug = currentSlug.value;
			return docsRegistry[slug]?.title ?? 'Getting Started';
		});

		useHead({
			title: `${pageTitle.value} - Effuse Docs`,
			description: `Documentation for ${pageTitle.value} in the Effuse framework.`,
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
			tocItems={tocItems.value}
		>
			<article class="prose prose-slate max-w-none">
				<Ink content={content.value} />
			</article>
		</DocsLayout>
	),
});
