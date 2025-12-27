---
title: Emisión de Eventos (useEmits)
---

# Emisión de Eventos (useEmits)

Effuse proporciona un sistema de emisión de eventos potente y con tipos seguros a través del hook `useEmits`. Permite que los componentes se comuniquen mediante eventos mientras mantienen la reactividad completa con el sistema de señales de Effuse.

## Conceptos Fundamentales

El sistema de emisión se basa en tres ideas principales:

1. **Eventos con Tipos Seguros**: Define tus tipos de eventos en una interfaz para obtener inferencia completa de TypeScript
2. **Señales Reactivas**: Cada evento emitido también se almacena en una señal reactiva para enlace de UI
3. **Patrón de Suscripción**: Suscríbete y desuscríbete de eventos con limpieza automática

## Uso Básico

### Definición de Tipos de Eventos

Comienza definiendo una interfaz que describa tus eventos:

```typescript
interface ChatEvents {
	message: { text: string; author: string; timestamp: number };
	userJoined: { userId: string; name: string };
	userLeft: { userId: string };
}
```

### Creación de un Emisor

Usa el hook `useEmits` para crear un emisor de eventos tipado:

```typescript
import { define, useEmits } from '@effuse/core';

const ChatRoom = define({
  script: () => {
    const { emit, on, off, context } = useEmits<ChatEvents>({
      // Opcional: registrar manejadores iniciales
      message: (msg) => console.log('Nuevo mensaje:', msg.text),
    });

    // Emitir un evento
    const sendMessage = (text: string) => {
      emit('message', {
        text,
        author: 'Usuario',
        timestamp: Date.now(),
      });
    };

    return { sendMessage };
  },
  template: ({ sendMessage }) => (
    <button onClick={() => sendMessage('¡Hola!')}>Enviar</button>
  ),
});
```

## Referencia de la API

### useEmits<T>

Crea un emisor de eventos tipado con soporte de suscripción.

```typescript
function useEmits<T extends EventMap>(
	initialHandlers?: Partial<{ [K in keyof T]: EmitHandler<T[K]> }>
): {
	emit: EmitFn<T>;
	emitAsync: EmitFnAsync<T>;
	on: SubscribeFn<T>;
	off: (event: K, handler: EmitHandler<T[K]>) => void;
	context: EmitContextData<T>;
};
```

#### Valores de Retorno

| Propiedad   | Tipo                       | Descripción                                               |
| ----------- | -------------------------- | --------------------------------------------------------- |
| `emit`      | `EmitFn<T>`                | Emite un evento síncronamente con una carga               |
| `emitAsync` | `EmitFnAsync<T>`           | Emite un evento asíncronamente (próxima microtarea)       |
| `on`        | `SubscribeFn<T>`           | Se suscribe a un evento, retorna función de desuscripción |
| `off`       | `(event, handler) => void` | Desuscribe manualmente un manejador                       |
| `context`   | `EmitContextData<T>`       | Contexto interno para usar con `useEventSignal`           |

### useEventSignal<T, P>

Crea una señal reactiva que se actualiza cada vez que se emite un evento específico.

```typescript
function useEventSignal<T extends EventMap, P>(
	ctx: EmitContextData<T>,
	event: string,
	options?: EmitOptions
): EventSignal<P>;
```

#### Opciones

| Opción     | Tipo                         | Descripción                                                |
| ---------- | ---------------------------- | ---------------------------------------------------------- |
| `debounce` | `number`                     | Retrasa las actualizaciones por milisegundos especificados |
| `throttle` | `number`                     | Limita las actualizaciones a una vez por intervalo         |
| `once`     | `boolean`                    | Solo actualiza una vez, luego se detiene                   |
| `filter`   | `(payload: unknown) => bool` | Solo actualiza si el predicado retorna verdadero           |

#### Ejemplo

```typescript
const { emit, context } = useEmits<ChatEvents>();

// Crear una señal reactiva para el último mensaje
const lastMessage = useEventSignal<ChatEvents, ChatEvents['message']>(
  context,
  'message',
  { debounce: 100 }
);

// Usar en la plantilla - ¡se actualiza automáticamente!
<p>Último: {lastMessage.value?.text}</p>
```

## Modificadores de Eventos

Effuse proporciona funciones utilitarias para controlar cómo se procesan los eventos:

### createDebounce

Retrasa la ejecución del callback hasta un período de inactividad:

```typescript
import { createDebounce } from '@effuse/core';

const debounce = createDebounce<string>(300); // Retraso de 300ms

debounce.apply('término de búsqueda', (value) => {
	performSearch(value);
});

// Cancelar ejecución pendiente
debounce.cancel();
```

### createThrottle

Limita la ejecución del callback a una vez por intervalo:

```typescript
import { createThrottle } from '@effuse/core';

const throttle = createThrottle<MouseEvent>(100); // Máximo una vez por 100ms

document.addEventListener('mousemove', (e) => {
	throttle.apply(e, (event) => {
		updatePosition(event.clientX, event.clientY);
	});
});

// Reiniciar estado del throttle
throttle.reset();
```

### createOnce

Asegura que el callback solo se ejecute una vez:

```typescript
import { createOnce } from '@effuse/core';

const once = createOnce<void>();

button.addEventListener('click', () => {
	once.apply(undefined, () => {
		initializeApp();
	});
});

// Verificar si ya se ejecutó
console.log(once.hasFired()); // true después del primer clic

// Reiniciar para permitir ejecutar de nuevo
once.reset();
```

### createFilter

Procesa eventos condicionalmente basado en un predicado:

```typescript
import { createFilter } from '@effuse/core';

const filter = createFilter<number>((n) => n > 10);

filter.apply(5, (n) => console.log(n)); // Omitido
filter.apply(15, (n) => console.log(n)); // Registra: 15
```

## API del Servicio

Para casos de uso avanzados, puedes acceder al servicio de emisión subyacente:

```typescript
import { getEmitService } from '@effuse/core';

const service = getEmitService();

// Crear un contexto independiente
const ctx = service.createContext<MyEvents>();

// Registrar manejadores
const unsubscribe = service.registerHandler(ctx, 'eventName', handler);

// Emitir eventos
service.emit(ctx, 'eventName', payload);

// Obtener señal reactiva para un evento
const signal = service.getSignal(ctx, 'eventName');
```

## Definiciones de Tipos

```typescript
// Restricción del mapa de eventos base
type EventMap = Record<string, any>;

// Tipo de función manejadora
type EmitHandler<P> = (payload: P) => void;

// Tipo de función de emisión
type EmitFn<T extends EventMap> = <K extends keyof T & string>(
	event: K,
	payload: T[K]
) => void;

// Tipo de función de emisión asíncrona
type EmitFnAsync<T extends EventMap> = <K extends keyof T & string>(
	event: K,
	payload: T[K]
) => Promise<void>;

// Tipo de función de suscripción
type SubscribeFn<T extends EventMap> = <K extends keyof T & string>(
	event: K,
	handler: EmitHandler<T[K]>
) => () => void;

// Señal de evento (solo lectura)
type EventSignal<P> = ReadonlySignal<P | undefined>;
```

## Mejores Prácticas

1. **Define los Tipos Primero**: Siempre crea una interfaz para tus eventos
2. **Usa Funciones de Desuscripción**: Guarda y llama la función retornada por `on()` durante la limpieza
3. **Prefiere Señales Reactivas**: Usa `useEventSignal` para enlaces de UI en lugar de suscribirse en efectos
4. **Aplica Modificadores**: Usa debounce/throttle para eventos de alta frecuencia como movimientos del ratón o escritura
5. **Agrupa Eventos Relacionados**: Múltiples emisiones síncronas se agrupan automáticamente por rendimiento
