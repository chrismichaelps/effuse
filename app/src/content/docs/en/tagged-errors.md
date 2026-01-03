---
title: Error Handling
---

# Error Handling

Effuse provides a robust error handling system using **Tagged Errors** to provide type-safe, discriminable error handling across your application.

## TaggedError

A `TaggedError` is a special class that includes a `_tag` property. This allows for clean exhaustive pattern matching and ensures that errors retain their identity even after serialization.

### Definition

```typescript
import { TaggedError } from '@effuse/core';

export class NetworkError extends TaggedError('NetworkError')<{
	readonly url: string;
	readonly status: number;
	readonly message: string;
}> {}
```

### Usage

When an error is thrown, you can catch it and use Type Guards to narrow down the specific error type.

```typescript
import { isTaggedError, hasTag } from '@effuse/core';

try {
	// ... code that might throw
} catch (error) {
	if (hasTag(error, 'NetworkError')) {
		// TypeScript knows error is NetworkError
		console.error(`Status ${error.status}: ${error.message}`);
	} else if (isTaggedError(error)) {
		// Any other tagged error
		console.error(`Tagged error: ${error._tag}`);
	}
}
```

## Type Guards

Effuse exports two main utilities for working with tagged errors:

### `isTaggedError(value)`

Returns `true` if the value is an `Error` that contains a `_tag` property of type `string`.

### `hasTag(value, tag)`

Returns `true` if the value is a `TaggedError` with the specific tag provided. This is the most common way to narrow errors in a `catch` block.

## Why use Tagged Errors?

1. **Type Safety**: Automatic narrowing of error properties in `if` or `switch` blocks.
2. **Serialization**: Standard JavaScript `instanceof` fails after `JSON.parse()`, but `_tag` is a plain string that survives serialization.
3. **Developer Experience**: Clearly defines the "contract" of possible errors a function might return.
