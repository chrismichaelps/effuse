import { recordEvent } from '../../internal/telemetry.js';

const HOOK_NAME = 'useClipboard' as const;

export const traceClipboard = (
	event: 'init' | 'permission' | 'read' | 'write' | 'error',
	attributes?: Record<string, string | number | boolean>
): void => {
	recordEvent(HOOK_NAME, event, attributes);
};
