# useOnline

Reactive hook for detecting network connectivity status.

## Usage

```typescript
import { useOnline } from '@effuse/use';

const { isOnline, isOffline } = useOnline();

// Reactive: updates when network status changes
if (isOnline.value) {
	console.log('Connected to the internet');
} else {
	console.log('No internet connection');
}
```

## Configuration

| Option         | Type      | Default | Description           |
| :------------- | :-------- | :------ | :-------------------- |
| `initialValue` | `boolean` | `true`  | Initial state for SSR |

## Returns

| Property    | Type                      | Description                |
| :---------- | :------------------------ | :------------------------- |
| `isOnline`  | `ReadonlySignal<boolean>` | Whether browser is online  |
| `isOffline` | `ReadonlySignal<boolean>` | Whether browser is offline |

## Examples

### Basic Usage

```typescript
const { isOnline } = useOnline();

effect(() => {
	if (!isOnline.value) {
		showOfflineNotification();
	}
});
```

### Conditional API Calls

```typescript
const { isOnline } = useOnline();

const fetchData = async () => {
	if (!isOnline.value) {
		return getCachedData();
	}
	return fetchFromServer();
};
```

### SSR with Offline Default

```typescript
const { isOnline } = useOnline({
	initialValue: false, // Assume offline during SSR
});
```

## Edge Cases

- **SSR:** Returns `initialValue` (defaults to `true`)
- **Network Flapping:** Updates reactively on each change
- **Cleanup:** Event listeners are automatically removed on dispose
