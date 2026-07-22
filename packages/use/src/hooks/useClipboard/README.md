# useClipboard

Permission-aware, lifecycle-owned clipboard read and write operations.

```ts
const clipboard = useClipboard({ copiedDuration: 2_000 });

if (!(await clipboard.copy('Effuse'))) {
  console.error(clipboard.error.value);
}
```

`copy` resolves to a boolean and `read` resolves to text or `null`; capability
absence, denied permissions, and API failures become typed `ClipboardError`
state rather than rejected promises. `canRead` and `canWrite` are independent.

Permission querying is best-effort because browser support differs. Disable it
with `queryPermissions: false`. Successful writes set `copied` temporarily.
Timers, permission listeners, and late async updates are stopped on unmount.
