/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useHead, isServer } from './use-head.js';
import type { HeadProps, MetaTag } from './types.js';

export interface SeoMetaInput {
	title?: string;
	description?: string;
	keywords?: string;
	author?: string;
	robots?: string;
	generator?: string;
	applicationName?: string;
	referrer?:
		| 'no-referrer'
		| 'no-referrer-when-downgrade'
		| 'origin'
		| 'origin-when-cross-origin'
		| 'same-origin'
		| 'strict-origin'
		| 'strict-origin-when-cross-origin'
		| 'unsafe-url';

	themeColor?: string;
	colorScheme?: 'normal' | 'light' | 'dark' | 'light dark' | 'dark light';

	ogTitle?: string;
	ogDescription?: string;
	ogType?: string;
	ogUrl?: string;
	ogImage?: string;
	ogImageAlt?: string;
	ogImageWidth?: string | number;
	ogImageHeight?: string | number;
	ogImageType?: string;
	ogLocale?: string;
	ogLocaleAlternate?: string[];
	ogSiteName?: string;
	ogDeterminer?: 'a' | 'an' | 'the' | '' | 'auto';

	articlePublishedTime?: string;
	articleModifiedTime?: string;
	articleExpirationTime?: string;
	articleAuthor?: string | string[];
	articleSection?: string;
	articleTag?: string | string[];

	twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
	twitterSite?: string;
	twitterSiteId?: string;
	twitterCreator?: string;
	twitterCreatorId?: string;
	twitterTitle?: string;
	twitterDescription?: string;
	twitterImage?: string;
	twitterImageAlt?: string;

	fbAppId?: string;

	googleSiteVerification?: string;
	yandexVerification?: string;
	msValidate?: string;

	appleItunesApp?: string;
	appleMobileWebAppCapable?: 'yes' | 'no';
	appleMobileWebAppStatusBarStyle?: 'default' | 'black' | 'black-translucent';
	appleMobileWebAppTitle?: string;

	formatDetection?: string;
}

const seoMetaToHeadProps = (input: SeoMetaInput): HeadProps => {
	const meta: MetaTag[] = [];
	const head: HeadProps = {};

	if (input.title) (head as Record<string, unknown>).title = input.title;
	if (input.description) {
		(head as Record<string, unknown>).description = input.description;
		meta.push({ name: 'description', content: input.description });
	}
	if (input.keywords) meta.push({ name: 'keywords', content: input.keywords });
	if (input.author) meta.push({ name: 'author', content: input.author });
	if (input.robots) (head as Record<string, unknown>).robots = input.robots;
	if (input.generator)
		meta.push({ name: 'generator', content: input.generator });
	if (input.applicationName)
		meta.push({ name: 'application-name', content: input.applicationName });
	if (input.referrer) meta.push({ name: 'referrer', content: input.referrer });

	if (input.themeColor)
		(head as Record<string, unknown>).themeColor = input.themeColor;
	if (input.colorScheme)
		meta.push({ name: 'color-scheme', content: input.colorScheme });

	if (input.ogTitle)
		meta.push({ property: 'og:title', content: input.ogTitle });
	if (input.ogDescription)
		meta.push({ property: 'og:description', content: input.ogDescription });
	if (input.ogType) meta.push({ property: 'og:type', content: input.ogType });
	if (input.ogUrl) meta.push({ property: 'og:url', content: input.ogUrl });
	if (input.ogImage)
		meta.push({ property: 'og:image', content: input.ogImage });
	if (input.ogImageAlt)
		meta.push({ property: 'og:image:alt', content: input.ogImageAlt });
	if (input.ogImageWidth)
		meta.push({
			property: 'og:image:width',
			content: String(input.ogImageWidth),
		});
	if (input.ogImageHeight)
		meta.push({
			property: 'og:image:height',
			content: String(input.ogImageHeight),
		});
	if (input.ogImageType)
		meta.push({ property: 'og:image:type', content: input.ogImageType });
	if (input.ogLocale)
		meta.push({ property: 'og:locale', content: input.ogLocale });
	if (input.ogSiteName)
		meta.push({ property: 'og:site_name', content: input.ogSiteName });
	if (input.ogDeterminer)
		meta.push({ property: 'og:determiner', content: input.ogDeterminer });

	if (input.articlePublishedTime)
		meta.push({
			property: 'article:published_time',
			content: input.articlePublishedTime,
		});
	if (input.articleModifiedTime)
		meta.push({
			property: 'article:modified_time',
			content: input.articleModifiedTime,
		});
	if (input.articleExpirationTime)
		meta.push({
			property: 'article:expiration_time',
			content: input.articleExpirationTime,
		});
	if (input.articleSection)
		meta.push({ property: 'article:section', content: input.articleSection });

	if (input.articleAuthor) {
		const authors = Array.isArray(input.articleAuthor)
			? input.articleAuthor
			: [input.articleAuthor];
		authors.forEach((author) =>
			meta.push({ property: 'article:author', content: author })
		);
	}

	if (input.articleTag) {
		const tags = Array.isArray(input.articleTag)
			? input.articleTag
			: [input.articleTag];
		tags.forEach((tag) => meta.push({ property: 'article:tag', content: tag }));
	}

	if (input.twitterCard)
		meta.push({ name: 'twitter:card', content: input.twitterCard });
	if (input.twitterSite)
		meta.push({ name: 'twitter:site', content: input.twitterSite });
	if (input.twitterSiteId)
		meta.push({ name: 'twitter:site:id', content: input.twitterSiteId });
	if (input.twitterCreator)
		meta.push({ name: 'twitter:creator', content: input.twitterCreator });
	if (input.twitterCreatorId)
		meta.push({ name: 'twitter:creator:id', content: input.twitterCreatorId });
	if (input.twitterTitle)
		meta.push({ name: 'twitter:title', content: input.twitterTitle });
	if (input.twitterDescription)
		meta.push({
			name: 'twitter:description',
			content: input.twitterDescription,
		});
	if (input.twitterImage)
		meta.push({ name: 'twitter:image', content: input.twitterImage });
	if (input.twitterImageAlt)
		meta.push({ name: 'twitter:image:alt', content: input.twitterImageAlt });

	if (input.fbAppId)
		meta.push({ property: 'fb:app_id', content: input.fbAppId });

	if (input.googleSiteVerification)
		meta.push({
			name: 'google-site-verification',
			content: input.googleSiteVerification,
		});
	if (input.yandexVerification)
		meta.push({
			name: 'yandex-verification',
			content: input.yandexVerification,
		});
	if (input.msValidate)
		meta.push({ name: 'msvalidate.01', content: input.msValidate });

	if (input.appleItunesApp)
		meta.push({ name: 'apple-itunes-app', content: input.appleItunesApp });
	if (input.appleMobileWebAppCapable)
		meta.push({
			name: 'apple-mobile-web-app-capable',
			content: input.appleMobileWebAppCapable,
		});
	if (input.appleMobileWebAppStatusBarStyle)
		meta.push({
			name: 'apple-mobile-web-app-status-bar-style',
			content: input.appleMobileWebAppStatusBarStyle,
		});
	if (input.appleMobileWebAppTitle)
		meta.push({
			name: 'apple-mobile-web-app-title',
			content: input.appleMobileWebAppTitle,
		});

	if (input.formatDetection)
		meta.push({ name: 'format-detection', content: input.formatDetection });

	if (meta.length > 0) {
		(head as Record<string, unknown>).meta = meta;
	}

	return head;
};

export const useSeoMeta = (input: SeoMetaInput): void => {
	const headProps = seoMetaToHeadProps(input);
	useHead(headProps);
};

export const useServerSeoMeta = (input: SeoMetaInput): void => {
	if (!isServer()) return;

	const headProps = seoMetaToHeadProps(input);
	useHead(headProps);
};
