<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  Reactive, typed Markdown rendering for Effuse components.
</p>

# `@effuse/ink`

Ink parses Markdown into a typed AST and renders Effuse nodes with optional
component overrides. URL sanitization is enabled in the renderer so links and
images do not bypass the package's protocol policy.

## Install

```bash
pnpm add @effuse/ink @effuse/core
```

`@effuse/core` is a peer dependency and must use the compatible version declared
by the package.

## Component Usage

```tsx
import { define } from '@effuse/core';
import { Ink } from '@effuse/ink';

const markdown = '# Release notes\n\nRead the **current** changes.';

export const ReleaseNotes = define({
	script: () => ({ markdown }),
	template: ({ markdown }) => <Ink content={markdown} class="docs" />,
});
```

`content` accepts a string or a signal-like object with a string `value`. The
component recomputes its AST and rendered nodes when reactive content changes.

Override standard tags or named Markdown components through `components`:

```tsx
<Ink
	content={markdown}
	components={{
		a: ExternalLink,
		code: CodeSample,
	}}
/>
```

## Parse And Render

```ts
import { parseSync, render } from '@effuse/ink';

const document = parseSync(markdown);
const children = render(markdown, { code: CodeSample });
```

Use `parseSync` when tooling needs the typed `DocumentNode`. Use `render` for a
standalone `EffuseChild[]`; malformed input returns an empty result through this
convenience API, while lower-level parser and transformer errors remain exported
for explicit handling.

## Public Surface

| Area      | APIs                                                     |
| --------- | -------------------------------------------------------- |
| Component | `Ink`, `InkProps`, `InkComponents`                       |
| Pipeline  | `parseSync`, `transformDocument`, `render`               |
| Security  | `sanitizeUrl`, `SanitizeUrlOptions`, `SanitizationError` |
| AST       | Markdown node types and runtime schemas                  |
| Styling   | `InkLayer`, `injectInkStyles`, `inkProseStyles`          |

## Security And SSR

- Keep sanitization enabled for untrusted Markdown. Raw HTML is disabled by
  default and should not be enabled for user-controlled content.
- Component overrides execute application code; only register trusted
  components and validate their props at the application boundary.
- Parsing and transformation do not require `window` or `document`, so the same
  Markdown tree can render during SSR and hydration.
- Heading IDs are deterministic within each document, including duplicate and
  non-Latin headings.
