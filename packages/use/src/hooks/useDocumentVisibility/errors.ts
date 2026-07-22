export class DocumentVisibilityError extends Error {
	readonly _tag = 'DocumentVisibilityError';
	readonly code = 'LISTENER_FAILED';

	constructor(cause: unknown) {
		super('[useDocumentVisibility] Failed to observe document visibility', {
			cause,
		});
		this.name = 'DocumentVisibilityError';
	}
}
