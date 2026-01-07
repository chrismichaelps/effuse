---
title: Manejo de Errores
---

# Manejo de Errores

Effuse proporciona un sistema de manejo de errores robusto que utiliza **Errores Etiquetados** (Tagged Errors) para proporcionar un manejo de errores seguro y discriminable en toda tu aplicación.

## TaggedError

Un `TaggedError` es una clase especial que incluye una propiedad `_tag`. Esto permite un emparejamiento de patrones exhaustivo y limpio, y asegura que los errores mantengan su identidad incluso después de la serialización.

### Definición

```typescript
import { TaggedError } from '@effuse/core';

export class NetworkError extends TaggedError('NetworkError')<{
	readonly url: string;
	readonly status: number;
	readonly message: string;
}> {}
```

### Uso

Cuando se lanza un error, puedes capturarlo y usar protectores de tipo (Type Guards) para identificar el tipo de error específico.

```typescript
import { isTaggedError, hasTag } from '@effuse/core';

try {
	// ... código que podría lanzar un error
} catch (error) {
	if (hasTag(error, 'NetworkError')) {
		// TypeScript sabe que error es NetworkError
		console.error(`Estado ${error.status}: ${error.message}`);
	} else if (isTaggedError(error)) {
		// Cualquier otro error etiquetado
		console.error(`Error etiquetado: ${error._tag}`);
	}
}
```

## Protectores de Tipo

Effuse exporta dos utilidades principales para trabajar con errores etiquetados:

### `isTaggedError(value)`

Devuelve `true` si el valor es un `Error` que contiene una propiedad `_tag` de tipo `string`.

### `hasTag(value, tag)`

Devuelve `true` si el valor es un `TaggedError` con la etiqueta específica proporcionada. Esta es la forma más común de filtrar errores en un bloque `catch`.

## ¿Por qué usar Errores Etiquetados?

1. **Seguridad de Tipos**: Reducción automática de las propiedades del error en bloques `if` o `switch`.
2. **Serialización**: El `instanceof` estándar de JavaScript falla después de `JSON.parse()`, pero `_tag` es una cadena simple que sobrevive a la serialización.
3. **Experiencia del Desarrollador**: Define claramente el "contrato" de los posibles errores que una función podría devolver.
