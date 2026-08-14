<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  Type-safe, reactive internationalization for Effuse applications.
</p>

# @effuse/i18n

`@effuse/i18n` provides nested translations, interpolation, pluralization,
locale fallback, lazy locale loading, and request-scoped server rendering.

## Install

```bash
pnpm add @effuse/i18n
```

## Basic Usage

```ts
import { createI18n, defineTranslations } from '@effuse/i18n';

const en = defineTranslations({
	greeting: 'Hello, {{name}}!',
	items: { one: '{{count}} item', other: '{{count}} items' },
});

export const i18n = createI18n({
	defaultLocale: 'en',
	fallbackLocale: 'en',
	translations: { en },
	loader: async (locale) => {
		const response = await fetch(`/locales/${locale}.json`);
		if (!response.ok) throw new Error(`Unable to load ${locale}`);
		return response.json();
	},
});
```

```ts
import { t, setLocale } from '@effuse/i18n';

t('greeting', { name: 'Ada' });
await setLocale('es');
```

Locale changes are transactional. Concurrent requests for the same unloaded
locale share one loader call, only the latest requested locale becomes active,
and a failed load rejects with `LocaleLoadError` without changing or persisting
the current locale.

## Server Rendering

Create one instance per request and bind it while rendering. Request-scoped
instances disable browser detection and persistence by default, preventing
locale state from leaking between concurrent requests.

```ts
import { createI18nInstance, withI18n } from '@effuse/i18n';

const i18n = createI18nInstance({
	defaultLocale: requestLocale,
	translations: { [requestLocale]: messages },
});

const html = await withI18n(i18n, () => renderApplication());
```

## Public API

- `createI18n` registers an application-wide instance.
- `createI18nInstance` creates an isolated instance for SSR or testing.
- `withI18n` binds an instance to the current runtime context.
- `useTranslation` exposes reactive translation helpers to components.
- `defineTranslations` preserves literal keys for type inference.
- `t`, `setLocale`, and `getLocale` access the current bound instance.

## Production Boundaries

- Negotiate and validate the request locale before creating the SSR instance.
- Load only trusted translation data; interpolation is not a substitute for
  HTML sanitization when rendering rich content.
- Treat `LocaleLoadError` as recoverable application state and retain the
  previous locale when loading fails.
- Keep browser persistence disabled in request-scoped instances. The
  application-wide instance owns browser detection and persisted preferences.
