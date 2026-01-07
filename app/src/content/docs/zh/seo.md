---
title: SEO 与 Head 管理
---

# SEO 与 Head 管理

Effuse 提供 `useHead` 钩子用于管理文档 head 元素，如标题、meta 标签、Open Graph 和 Twitter Cards。

## 基本用法

从 `@effuse/core` 导入 `useHead` 并在组件的 script 中调用：

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

## API 参考

### HeadProps

`useHead` 函数接受具有以下属性的 `HeadProps` 对象：

| 属性            | 类型                 | 描述                   |
| --------------- | -------------------- | ---------------------- |
| `title`         | `string`             | 设置文档标题           |
| `titleTemplate` | `string or function` | 标题格式化模板         |
| `description`   | `string`             | SEO 的元描述           |
| `canonical`     | `string`             | 规范 URL               |
| `viewport`      | `string`             | 视口 meta 标签内容     |
| `charset`       | `string`             | 字符编码               |
| `lang`          | `string`             | HTML lang 属性         |
| `themeColor`    | `string`             | 浏览器主题颜色         |
| `favicon`       | `string`             | 网站图标 URL           |
| `robots`        | `string`             | robots meta 指令       |
| `og`            | `OpenGraphProps`     | Open Graph meta 标签   |
| `twitter`       | `TwitterCardProps`   | Twitter Card meta 标签 |
| `meta`          | `MetaTag[]`          | 额外的自定义 meta 标签 |
| `link`          | `LinkTag[]`          | 额外的 link 标签       |
| `script`        | `ScriptTag[]`        | 要注入的 script 标签   |
| `base`          | `string`             | 基础 URL               |
| `htmlAttrs`     | `Record`             | html 标签的属性        |
| `bodyAttrs`     | `Record`             | body 标签的属性        |

### OpenGraphProps

| 属性          | 类型     | 描述                            |
| ------------- | -------- | ------------------------------- |
| `title`       | `string` | Open Graph 标题                 |
| `description` | `string` | Open Graph 描述                 |
| `type`        | `string` | 内容类型（website、article 等） |
| `url`         | `string` | 规范 URL                        |
| `image`       | `string` | 预览图片 URL                    |
| `siteName`    | `string` | 网站名称                        |
| `locale`      | `string` | 区域设置（en_US 等）            |

### TwitterCardProps

| 属性          | 类型     | 描述                                                  |
| ------------- | -------- | ----------------------------------------------------- |
| `card`        | `string` | 卡片类型：summary、summary_large_image、app 或 player |
| `site`        | `string` | 网站的 Twitter @用户名                                |
| `creator`     | `string` | 创建者的 Twitter @用户名                              |
| `title`       | `string` | 卡片标题                                              |
| `description` | `string` | 卡片描述                                              |
| `image`       | `string` | 卡片图片 URL                                          |

### MetaTag

| 属性        | 类型     | 描述                          |
| ----------- | -------- | ----------------------------- |
| `name`      | `string` | meta name 属性                |
| `property`  | `string` | meta property 属性（用于 OG） |
| `content`   | `string` | meta content 值（必需）       |
| `httpEquiv` | `string` | HTTP-equiv 属性               |

## 包含社交标签的完整示例

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

## 动态标题

基于响应式状态的动态标题：

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

## 最佳实践

1. **为每个页面设置标题** — 每个页面都应有唯一的描述性标题
2. **包含网站名称** — 在页面标题中附加网站/应用名称
3. **保持描述简洁** — 搜索结果描述限制在约 155 个字符
4. **在脚本中尽早调用** — 在脚本函数顶部调用 `useHead`
5. **使用 Open Graph** — 添加 OG 标签以获得更好的社交媒体预览
