export type TimeoutErrorCode = 'INVALID_DELAY' | 'CALLBACK_FAILED';

export class TimeoutError extends Error {
	readonly _tag = 'TimeoutError';

	constructor(
		readonly code: TimeoutErrorCode,
		message: string,
		options?: ErrorOptions
	) {
		super(message, options);
		this.name = 'TimeoutError';
	}
}

export const invalidTimeoutDelay = (delay: number): TimeoutError =>
	new TimeoutError(
		'INVALID_DELAY',
		`[useTimeout] Delay must be a finite number greater than or equal to 0; received ${String(delay)}`
	);

export const timeoutCallbackFailed = (cause: unknown): TimeoutError =>
	new TimeoutError('CALLBACK_FAILED', '[useTimeout] Callback failed', { cause });
