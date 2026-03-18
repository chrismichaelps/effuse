---
title: Markdown Rendering
description: Render reactive Markdown with custom components using @effuse/ink
---

# Markdown Rendering

The `@effuse/ink` package provides a powerful, reactive Markdown renderer for Effuse applications. It goes beyond static HTML generation by allowing you to map Markdown elements to Effuse components and embed interactive islands within your content.

## Installation

```bash
npm install @effuse/ink
```

## Basic Usage

The core of the package is the `Ink` component. It takes a markdown string and renders it reactively.

```tsx
import { define } from '@effuse/core';
import { Ink } from '@effuse/ink';

export default define({
  script: () => {
    const content = '# Hello from Ink\n\nThis is **reactive** markdown.';
    return { content };
  },
  template: ({ content }) => <Ink content={content} />,
});
```

### Props

| Prop         | Type                          | Description                                            |
| :----------- | :---------------------------- | :----------------------------------------------------- |
| `content`    | `string \| { value: string }` | The markdown content to render. Can be a signal value. |
| `components` | `InkComponents`               | Custom component mapping (see below).                  |
| `class`      | `string`                      | Optional CSS class for the wrapper element.            |

## Custom Components

You can replace standard Markdown elements (like `p`, `a`, `h1`, `code`) with your own Effuse components. This is powerful for using design system components or adding interactivity.

```tsx
import { Ink } from '@effuse/ink';
import { Link } from '@effuse/router';
import { Button } from './components/Button';

// Custom component for links
const CustomLink = ({ href, children }) => (
  <Link to={href} class="text-blue-500 hover:underline">
    {children}
  </Link>
);

// Custom code block
const CodeBlock = ({ children, className }) => (
  <pre class={`p-4 rounded bg-gray-900 ${className}`}>
    <code>{children}</code>
  </pre>
);

const markdown = `
Check out our [documentation](/docs).

\`\`\`js
console.log('Hello');
\`\`\`
`;

<Ink
  content={markdown}
  components={{
    a: CustomLink,
    code: CodeBlock,
    // You can also map custom tags if your markdown supports them
    'my-button': Button,
  }}
/>;
```

## Global Configuration with InkLayer

Instead of passing components to every `Ink` instance, you can configure them globally using `InkLayer`.

```typescript
// src/layers/markdown.ts
import { defineLayer } from '@effuse/core';
import { InkLayer } from '@effuse/ink';
import { CustomLink, CodeBlock } from './components';

export const GlobalMarkdownLayer = defineLayer({
  name: 'GlobalMarkdown',
  provides: InkLayer,
  setup() {
    return {
      components: {
        a: CustomLink,
        code: CodeBlock,
      },
    };
  },
});
```

Register the layer in your app root, and all `Ink` instances will automatically use these components.

## Styling

`@effuse/ink` comes with a minimal set of base styles to ensure correct rendering. You can inject these globally:

```typescript
// src/main.ts
import { injectInkStyles } from '@effuse/ink';

// Injects styles into the document head
injectInkStyles();
```

The `Ink` component is unopinionated about visual style (fonts, colors, margins) and inherits from your CSS. You should wrap it in a `prose` class (like Tailwind's `@tailwindcss/typography`) or style the standard HTML tags (`p`, `h1`, etc.) globally.
