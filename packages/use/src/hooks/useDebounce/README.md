# useDebounce

Reactive hook for debouncing signal values with cancel and flush support.

## Usage

```typescript
import { useDebounce } from '@effuse/use';
import { signal } from '@effuse/core';

const searchInput = signal('');
const { value: debouncedSearch, isPending } = useDebounce({
	value: searchInput,
	delay: 300,
});

// debouncedSearch updates 300ms after searchInput stops changing
```

## Configuration

| Option  | Type        | Default    | Description          |
| :------ | :---------- | :--------- | :------------------- |
| `value` | `Signal<T>` | _required_ | Signal to debounce   |
| `delay` | `number`    | `300`      | Debounce delay in ms |

## Returns

| Property    | Type                      | Description                     |
| :---------- | :------------------------ | :------------------------------ |
| `value`     | `ReadonlySignal<T>`       | Debounced value                 |
| `isPending` | `ReadonlySignal<boolean>` | Whether debounce is pending     |
| `cancel`    | `() => void`              | Cancel pending debounce         |
| `flush`     | `() => void`              | Immediately apply pending value |

## Examples

### Search Input

```typescript
const searchQuery = signal('');
const { value: debouncedQuery, isPending } = useDebounce({
	value: searchQuery,
	delay: 300,
});

// Show loading indicator while typing
if (isPending.value) {
	showLoadingIndicator();
}
```

### Flush on Submit

```typescript
const formValue = signal({});
const { value: debouncedForm, flush } = useDebounce({
	value: formValue,
	delay: 500,
});

const handleSubmit = () => {
	flush(); // Ensure latest value is used
	submitForm(debouncedForm.value);
};
```

### Cancel on Unmount

```typescript
const { cancel } = useDebounce({
	value: expensiveComputation,
	delay: 1000,
});

// Cancel pending update when component unmounts
onCleanup(() => cancel());
```

## Edge Cases

- **Rapid Changes:** Timer resets on each change
- **Flush When Idle:** No-op if no pending value
- **Cancel When Idle:** No-op if no pending value
- **Cleanup:** Timeout is automatically cleared on dispose
