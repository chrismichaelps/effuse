---
title: SEO & Head Management
---

# SEO & Head Management

Effuse provides the `useHead` hook for managing document head elements like title, meta tags, Open Graph, and Twitter Cards.

## Basic Usage

Import `useHead` from `@effuse/core` and call it in your component's script:

```tsx
import { define, useHead } from '@effuse/core';

const HomePage = define({
	script: () => {
		useHead({
			title: 'Home - My App',
			description: 'Welcome to my awesome application.',
		});

		return {};
	},
	template: () => (
		<div>
			<h1>Welcome!</h1>
		</div>
	),
});
```

## API Reference

### HeadProps

The `useHead` function accepts a `HeadProps` object with the following properties:

| Property        | Type                 | Description                   |
| --------------- | -------------------- | ----------------------------- |
| `title`         | `string`             | Sets the document title       |
| `titleTemplate` | `string or function` | Template for title formatting |
| `description`   | `string`             | Meta description for SEO      |
| `canonical`     | `string`             | Canonical URL                 |
| `viewport`      | `string`             | Viewport meta tag content     |
| `charset`       | `string`             | Character encoding            |
| `lang`          | `string`             | HTML lang attribute           |
| `themeColor`    | `string`             | Browser theme color           |
| `favicon`       | `string`             | Favicon URL                   |
| `robots`        | `string`             | Robots meta directive         |
| `og`            | `OpenGraphProps`     | Open Graph meta tags          |
| `twitter`       | `TwitterCardProps`   | Twitter Card meta tags        |
| `meta`          | `MetaTag[]`          | Additional custom meta tags   |
| `link`          | `LinkTag[]`          | Additional link tags          |
| `script`        | `ScriptTag[]`        | Script tags to inject         |
| `base`          | `string`             | Base URL                      |
| `htmlAttrs`     | `Record`             | Attributes for html tag       |
| `bodyAttrs`     | `Record`             | Attributes for body tag       |

### OpenGraphProps

| Property      | Type     | Description                           |
| ------------- | -------- | ------------------------------------- |
| `title`       | `string` | Open Graph title                      |
| `description` | `string` | Open Graph description                |
| `type`        | `string` | Content type (website, article, etc.) |
| `url`         | `string` | Canonical URL                         |
| `image`       | `string` | Preview image URL                     |
| `siteName`    | `string` | Site name                             |
| `locale`      | `string` | Locale (en_US, etc.)                  |

### TwitterCardProps

| Property      | Type     | Description                                             |
| ------------- | -------- | ------------------------------------------------------- |
| `card`        | `string` | Card type: summary, summary_large_image, app, or player |
| `site`        | `string` | Twitter @username for the site                          |
| `creator`     | `string` | Twitter @username for the creator                       |
| `title`       | `string` | Card title                                              |
| `description` | `string` | Card description                                        |
| `image`       | `string` | Card image URL                                          |

### MetaTag

| Property    | Type     | Description                           |
| ----------- | -------- | ------------------------------------- |
| `name`      | `string` | Meta name attribute                   |
| `property`  | `string` | Meta property attribute (for OG tags) |
| `content`   | `string` | Meta content value (required)         |
| `httpEquiv` | `string` | HTTP-equiv attribute                  |

## Full Example with Social Tags

```tsx
import { define, useHead } from '@effuse/core';

const BlogPost = define({
	script: ({ props }) => {
		useHead({
			title: 'My Blog Post - Effuse Blog',
			description: 'Learn how to build reactive UIs with Effuse.',
			canonical: 'https://effuse.dev/blog/my-post',
			robots: 'index, follow',
			themeColor: '#10b981',

			og: {
				title: 'My Blog Post',
				description: 'Learn how to build reactive UIs.',
				type: 'article',
				url: 'https://effuse.dev/blog/my-post',
				image: 'https://effuse.dev/og-image.png',
				siteName: 'Effuse',
			},

			twitter: {
				card: 'summary_large_image',
				site: '@effuse',
				title: 'My Blog Post',
				description: 'Learn how to build reactive UIs.',
				image: 'https://effuse.dev/twitter-card.png',
			},
		});

		return {};
	},
	template: () => (
		<article>
			<h1>My Blog Post</h1>
		</article>
	),
});
```

## Dynamic Titles

For dynamic titles based on reactive state:

```tsx
import { define, signal, computed, useHead } from '@effuse/core';

const DocsPage = define({
	script: () => {
		const pageTitle = signal('Getting Started');

		useHead({
			title: `${pageTitle.value} - Effuse Docs`,
			description: `Documentation for ${pageTitle.value}.`,
		});

		return { pageTitle };
	},
	template: ({ pageTitle }) => <h1>{pageTitle}</h1>,
});
```

## Best Practices

1. **Set title on every page** — Each page should have a unique, descriptive title
2. **Include site name** — Append your site/app name to page titles
3. **Keep descriptions concise** — Limit descriptions to about 155 characters for search results
4. **Call early in script** — Call `useHead` at the top of your script function
5. **Use Open Graph** — Add OG tags for better social media previews
