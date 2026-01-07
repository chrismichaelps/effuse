---
title: SEO と Head 管理
---

# SEO と Head 管理

Effuse は、ドキュメントの head 要素（タイトル、メタタグ、Open Graph、Twitter Cards など）を管理するための `useHead` フックを提供します。

## 基本的な使用法

`@effuse/core` から `useHead` をインポートし、コンポーネントのスクリプトで呼び出します：

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

## API リファレンス

### HeadProps

`useHead` 関数は以下のプロパティを持つ `HeadProps` オブジェクトを受け取ります：

| プロパティ      | 型                   | 説明                               |
| --------------- | -------------------- | ---------------------------------- |
| `title`         | `string`             | ドキュメントタイトルを設定         |
| `titleTemplate` | `string or function` | タイトルフォーマットのテンプレート |
| `description`   | `string`             | SEO 用のメタ説明                   |
| `canonical`     | `string`             | 正規 URL                           |
| `viewport`      | `string`             | ビューポートメタタグの内容         |
| `charset`       | `string`             | 文字エンコーディング               |
| `lang`          | `string`             | HTML lang 属性                     |
| `themeColor`    | `string`             | ブラウザテーマカラー               |
| `favicon`       | `string`             | ファビコン URL                     |
| `robots`        | `string`             | robots メタディレクティブ          |
| `og`            | `OpenGraphProps`     | Open Graph メタタグ                |
| `twitter`       | `TwitterCardProps`   | Twitter Card メタタグ              |
| `meta`          | `MetaTag[]`          | 追加のカスタムメタタグ             |
| `link`          | `LinkTag[]`          | 追加のリンクタグ                   |
| `script`        | `ScriptTag[]`        | 注入するスクリプトタグ             |
| `base`          | `string`             | ベース URL                         |
| `htmlAttrs`     | `Record`             | html タグの属性                    |
| `bodyAttrs`     | `Record`             | body タグの属性                    |

### OpenGraphProps

| プロパティ    | 型       | 説明                                    |
| ------------- | -------- | --------------------------------------- |
| `title`       | `string` | Open Graph タイトル                     |
| `description` | `string` | Open Graph 説明                         |
| `type`        | `string` | コンテンツタイプ（website、article 等） |
| `url`         | `string` | 正規 URL                                |
| `image`       | `string` | プレビュー画像 URL                      |
| `siteName`    | `string` | サイト名                                |
| `locale`      | `string` | ロケール（en_US 等）                    |

### TwitterCardProps

| プロパティ    | 型       | 説明                                                           |
| ------------- | -------- | -------------------------------------------------------------- |
| `card`        | `string` | カードタイプ: summary、summary_large_image、app、または player |
| `site`        | `string` | サイトの Twitter @username                                     |
| `creator`     | `string` | 作成者の Twitter @username                                     |
| `title`       | `string` | カードタイトル                                                 |
| `description` | `string` | カード説明                                                     |
| `image`       | `string` | カード画像 URL                                                 |

### MetaTag

| プロパティ  | 型       | 説明                            |
| ----------- | -------- | ------------------------------- |
| `name`      | `string` | メタ name 属性                  |
| `property`  | `string` | メタ property 属性（OG タグ用） |
| `content`   | `string` | メタ content 値（必須）         |
| `httpEquiv` | `string` | HTTP-equiv 属性                 |

## ソーシャルタグを含む完全な例

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

## 動的タイトル

リアクティブな状態に基づく動的タイトル：

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

## ベストプラクティス

1. **すべてのページにタイトルを設定** — 各ページにはユニークで説明的なタイトルが必要
2. **サイト名を含める** — ページタイトルにサイト/アプリ名を追加
3. **説明を簡潔に** — 検索結果のため約 155 文字に制限
4. **スクリプトの早い段階で呼び出す** — スクリプト関数の先頭で `useHead` を呼び出す
5. **Open Graph を使用** — より良いソーシャルメディアプレビューのため OG タグを追加
