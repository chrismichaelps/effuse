---
title: SEO y Gestión del Head
---

# SEO y Gestión del Head

Effuse proporciona el hook `useHead` para gestionar elementos del head del documento como título, meta tags, Open Graph y Twitter Cards.

## Uso Básico

Importa `useHead` de `@effuse/core` y llámalo en el script de tu componente:

```tsx
import { define, useHead } from '@effuse/core';

const HomePage = define({
	script: () => {
		useHead({
			title: 'Inicio - Mi App',
			description: 'Bienvenido a mi aplicación increíble.',
		});

		return {};
	},
	template: () => (
		<div>
			<h1>¡Bienvenido!</h1>
		</div>
	),
});
```

## Referencia de API

### HeadProps

La función `useHead` acepta un objeto `HeadProps` con las siguientes propiedades:

| Propiedad       | Tipo               | Descripción                          |
| --------------- | ------------------ | ------------------------------------ |
| `title`         | `string`           | Establece el título del documento    |
| `titleTemplate` | `string o función` | Template para formateo del título    |
| `description`   | `string`           | Meta descripción para SEO            |
| `canonical`     | `string`           | URL canónica                         |
| `viewport`      | `string`           | Contenido del meta tag viewport      |
| `charset`       | `string`           | Codificación de caracteres           |
| `lang`          | `string`           | Atributo lang del HTML               |
| `themeColor`    | `string`           | Color del tema del navegador         |
| `favicon`       | `string`           | URL del favicon                      |
| `robots`        | `string`           | Directiva meta robots                |
| `og`            | `OpenGraphProps`   | Meta tags de Open Graph              |
| `twitter`       | `TwitterCardProps` | Meta tags de Twitter Card            |
| `meta`          | `MetaTag[]`        | Meta tags personalizados adicionales |
| `link`          | `LinkTag[]`        | Tags link adicionales                |
| `script`        | `ScriptTag[]`      | Tags script a inyectar               |
| `base`          | `string`           | URL base                             |
| `htmlAttrs`     | `Record`           | Atributos para tag html              |
| `bodyAttrs`     | `Record`           | Atributos para tag body              |

### OpenGraphProps

| Propiedad     | Tipo     | Descripción                                |
| ------------- | -------- | ------------------------------------------ |
| `title`       | `string` | Título de Open Graph                       |
| `description` | `string` | Descripción de Open Graph                  |
| `type`        | `string` | Tipo de contenido (website, article, etc.) |
| `url`         | `string` | URL canónica                               |
| `image`       | `string` | URL de imagen de vista previa              |
| `siteName`    | `string` | Nombre del sitio                           |
| `locale`      | `string` | Locale (en_US, etc.)                       |

### TwitterCardProps

| Propiedad     | Tipo     | Descripción                                               |
| ------------- | -------- | --------------------------------------------------------- |
| `card`        | `string` | Tipo de card: summary, summary_large_image, app, o player |
| `site`        | `string` | @username de Twitter para el sitio                        |
| `creator`     | `string` | @username de Twitter para el creador                      |
| `title`       | `string` | Título de la card                                         |
| `description` | `string` | Descripción de la card                                    |
| `image`       | `string` | URL de imagen de la card                                  |

### MetaTag

| Propiedad   | Tipo     | Descripción                               |
| ----------- | -------- | ----------------------------------------- |
| `name`      | `string` | Atributo name del meta                    |
| `property`  | `string` | Atributo property del meta (para tags OG) |
| `content`   | `string` | Valor del contenido del meta (requerido)  |
| `httpEquiv` | `string` | Atributo HTTP-equiv                       |

## Ejemplo Completo con Tags Sociales

```tsx
import { define, useHead } from '@effuse/core';

const BlogPost = define({
	script: ({ props }) => {
		useHead({
			title: 'Mi Post de Blog - Effuse Blog',
			description: 'Aprende cómo construir UIs reactivas con Effuse.',
			canonical: 'https://effuse.dev/blog/my-post',
			robots: 'index, follow',
			themeColor: '#10b981',

			og: {
				title: 'Mi Post de Blog',
				description: 'Aprende cómo construir UIs reactivas.',
				type: 'article',
				url: 'https://effuse.dev/blog/my-post',
				image: 'https://effuse.dev/og-image.png',
				siteName: 'Effuse',
			},

			twitter: {
				card: 'summary_large_image',
				site: '@effuse',
				title: 'Mi Post de Blog',
				description: 'Aprende cómo construir UIs reactivas.',
				image: 'https://effuse.dev/twitter-card.png',
			},
		});

		return {};
	},
	template: () => (
		<article>
			<h1>Mi Post de Blog</h1>
		</article>
	),
});
```

## Títulos Dinámicos

Para títulos dinámicos basados en estado reactivo:

```tsx
import { define, signal, computed, useHead } from '@effuse/core';

const DocsPage = define({
	script: () => {
		const pageTitle = signal('Primeros Pasos');

		useHead({
			title: `${pageTitle.value} - Docs de Effuse`,
			description: `Documentación para ${pageTitle.value}.`,
		});

		return { pageTitle };
	},
	template: ({ pageTitle }) => <h1>{pageTitle}</h1>,
});
```

## Mejores Prácticas

1. **Establece título en cada página** — Cada página debe tener un título único y descriptivo
2. **Incluye nombre del sitio** — Añade el nombre de tu sitio/app a los títulos
3. **Mantén descripciones concisas** — Limita las descripciones a unos 155 caracteres para resultados de búsqueda
4. **Llama temprano en script** — Llama `useHead` al inicio de tu función script
5. **Usa Open Graph** — Añade tags OG para mejores vistas previas en redes sociales
