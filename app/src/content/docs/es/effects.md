---
title: Efectos
---

# API de Efectos

Effuse proporciona funciones específicas para manejar efectos secundarios y observar cambios de estado.

## 1. effect

La función `effect` se ejecuta inmediatamente y se vuelve a ejecutar cada vez que sus señales rastreadas cambian.

```tsx
import { define, signal, effect } from '@effuse/core';

const DataFetcher = define({
	script: () => {
		const userId = signal(1);
		const userData = signal<any>(null);

		// Se ejecuta automáticamente cuando 'userId' cambia
		effect(() => {
			fetch(`/api/users/${userId.value}`)
				.then((res) => res.json())
				.then((data) => {
					userData.value = data;
				});
		});

		return { userId, userData };
	},
	template: ({ userId, userData }) => (
		<div>
			<button onClick={() => userId.value++}>Siguiente Usuario</button>
			<pre>{JSON.stringify(userData.value, null, 2)}</pre>
		</div>
	),
});
```

## 2. Sincronizando Datos con Efectos

Un patrón común es sincronizar datos externos con el estado del store:

```tsx
import { define, signal, effect } from '@effuse/core';
import { useInfiniteQuery } from '@effuse/query';
import { todosStore } from '../store/todosStore';

const TodosPage = define({
  script: () => {
    const todosQuery = useInfiniteQuery({
      queryKey: ['todos'],
      queryFn: async ({ pageParam }) => {
        const res = await fetch(`/api/todos?page=${pageParam}`);
        return res.json();
      },
      initialPageParam: 1,
    });

    const syncedPageCount = signal(0);

    // Sincronizar datos del servidor al store
    effect(() => {
      const pages = todosQuery.allPagesData.value;
      if (pages && pages.length > syncedPageCount.value) {
        if (syncedPageCount.value === 0) {
          todosStore.setTodos(pages.flat());
        } else {
          const newTodos = pages.slice(syncedPageCount.value).flat();
          todosStore.appendTodos(newTodos);
        }
        syncedPageCount.value = pages.length;
      }
    });

    return { todosQuery };
  },
  template: ...
});
```

## 3. watch

La función `watch` del contexto del script observa una señal específica y dispara un callback cuando cambia:

```tsx
import { define, signal } from '@effuse/core';

const Logger = define({
	script: ({ watch }) => {
		const count = signal(0);

		// Solo registra cuando count se actualiza
		watch(count, (newVal) => {
			console.log(`Contador cambió a: ${newVal}`);
		});

		return { count, increment: () => count.value++ };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>{count}</button>
	),
});
```

## 4. onMount para Efectos Secundarios

Usa `onMount` para efectos que deben ejecutarse una vez cuando el componente se monta:

```tsx
import { define } from '@effuse/core';

const Analytics = define({
	script: ({ onMount }) => {
		onMount(() => {
			console.log('Componente montado');

			// Retornar función de limpieza
			return () => {
				console.log('Componente desmontado');
			};
		});

		return {};
	},
	template: () => <div>Componente Rastreado</div>,
});
```

## Mejores Prácticas

1. **Usa effect para efectos secundarios reactivos** que deben volver a ejecutarse cuando las dependencias cambien
2. **Usa watch para señales específicas** cuando solo te importa que un valor cambie
3. **Usa onMount para inicialización** que debe ocurrir solo una vez
4. **Retorna funciones de limpieza** desde onMount para prevenir fugas de memoria
