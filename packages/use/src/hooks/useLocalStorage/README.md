# useLocalStorage

Reactive hook for persisting state in localStorage with automatic cross-tab synchronization.

## Usage

```typescript
import { useLocalStorage } from '@effuse/use';

const { value, remove } = useLocalStorage({
	key: 'user-preferences',
	defaultValue: { theme: 'dark', fontSize: 14 },
});

// Read
console.log(value.value.theme); // 'dark'

// Write (automatically persists)
value.value = { theme: 'light', fontSize: 16 };
```

## Configuration

| Option         | Type               | Default          | Description                  |
| :------------- | :----------------- | :--------------- | :--------------------------- |
| `key`          | `string`           | _required_       | localStorage key             |
| `defaultValue` | `T`                | _required_       | Value when key doesn't exist |
| `serializer`   | `(v: T) => string` | `JSON.stringify` | Custom serializer            |
| `deserializer` | `(v: string) => T` | `JSON.parse`     | Custom deserializer          |
| `syncTabs`     | `boolean`          | `true`           | Sync across browser tabs     |

## Returns

| Property      | Type             | Description                       |
| :------------ | :--------------- | :-------------------------------- |
| `value`       | `Signal<T>`      | Reactive signal (read/write)      |
| `isAvailable` | `boolean`        | Whether localStorage is available |
| `error`       | `string \| null` | Current error message             |
| `remove`      | `() => void`     | Remove from storage               |

## Examples

### Basic Usage

```typescript
const { value } = useLocalStorage({
	key: 'counter',
	defaultValue: 0,
});

value.value++; // Persisted automatically
```

### Custom Serialization

```typescript
const { value } = useLocalStorage({
	key: 'date',
	defaultValue: new Date(),
	serializer: (d) => d.toISOString(),
	deserializer: (s) => new Date(s),
});
```

### Disable Cross-Tab Sync

```typescript
const { value } = useLocalStorage({
	key: 'local-only',
	defaultValue: 'data',
	syncTabs: false,
});
```

## Edge Cases

- **SSR:** Returns `defaultValue` with `isAvailable = false`
- **Storage Full:** Sets `error` property without throwing
- **Cross-Tab:** Updates automatically when changed in another tab
- **Cleanup:** Event listeners are automatically removed on dispose
