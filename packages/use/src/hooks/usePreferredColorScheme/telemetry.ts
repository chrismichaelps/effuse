import { recordEvent } from '../../internal/telemetry.js';

const HOOK_NAME = 'usePreferredColorScheme' as const;

export const tracePreferredColorScheme = (
	event: 'init' | 'change' | 'unsupported' | 'error',
	scheme?: string
): void => {
	recordEvent(HOOK_NAME, event, scheme ? { 'color.scheme': scheme } : undefined);
};
