export type ClipboardErrorCode =
	| 'INVALID_DURATION'
	| 'UNSUPPORTED'
	| 'PERMISSION_DENIED'
	| 'PERMISSION_QUERY_FAILED'
	| 'READ_FAILED'
	| 'WRITE_FAILED';

export type ClipboardOperation = 'config' | 'permission' | 'read' | 'write';

export class ClipboardError extends Error {
	readonly _tag = 'ClipboardError';

	constructor(
		readonly code: ClipboardErrorCode,
		readonly operation: ClipboardOperation,
		message: string,
		options?: ErrorOptions
	) {
		super(`[useClipboard] ${message}`, options);
		this.name = 'ClipboardError';
	}
}
