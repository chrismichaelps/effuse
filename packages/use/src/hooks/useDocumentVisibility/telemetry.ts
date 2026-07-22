import { recordEvent } from '../../internal/telemetry.js';

const HOOK_NAME = 'useDocumentVisibility' as const;

export const traceDocumentVisibility = (
	event: 'init' | 'change' | 'unsupported' | 'error',
	state?: string
): void => {
	recordEvent(HOOK_NAME, event, state ? { 'visibility.state': state } : undefined);
};
