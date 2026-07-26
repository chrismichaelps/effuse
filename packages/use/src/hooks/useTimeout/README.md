# useTimeout

Lifecycle-owned timeout with pause, resume, restart, cancellation, remaining
time, completion state, and captured callback failures.

```ts
const timeout = useTimeout({
  delay: 5_000,
  callback: () => closeNotice(),
});

timeout.pause();
timeout.start(); // resumes the paused deadline
timeout.restart(); // resets to the configured delay
timeout.cancel(); // returns to idle
```

`immediate` defaults to `true`. Automatic start occurs on mount so SSR and the
client's initial render both begin in `idle`. SSR never schedules timers.

Invalid negative or non-finite delays throw `TimeoutError` with code
`INVALID_DELAY`. Callback exceptions are captured in `error` as
`CALLBACK_FAILED` after the timeout transitions to `completed`.
