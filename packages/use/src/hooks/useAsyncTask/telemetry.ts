import { recordEvent } from '../../internal/telemetry.js';

const HOOK_NAME = 'useAsyncTask' as const;

export const traceAsyncTask = (
	event:
		| 'init'
		| 'execute'
		| 'replace'
		| 'success'
		| 'error'
		| 'cancel'
		| 'reset'
		| 'dispose'
): void => {
	recordEvent(HOOK_NAME, event);
};
