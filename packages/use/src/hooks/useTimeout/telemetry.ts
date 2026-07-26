import { recordEvent } from '../../internal/telemetry.js';

const HOOK_NAME = 'useTimeout' as const;

export const traceTimeout = (
	event: 'init' | 'start' | 'pause' | 'cancel' | 'restart' | 'complete' | 'error',
	attributes?: Record<string, string | number | boolean>
): void => {
	recordEvent(HOOK_NAME, event, attributes);
};
