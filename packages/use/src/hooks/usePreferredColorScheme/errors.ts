export class PreferredColorSchemeError extends Error {
	readonly _tag = 'PreferredColorSchemeError';
	readonly code = 'LISTENER_FAILED';

	constructor(cause: unknown) {
		super('[usePreferredColorScheme] Failed to observe color preference', {
			cause,
		});
		this.name = 'PreferredColorSchemeError';
	}
}
