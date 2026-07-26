import { invalidTimeoutDelay } from './errors.js';

export const validateTimeoutDelay = (delay: number): number => {
	if (!Number.isFinite(delay) || delay < 0) {
		throw invalidTimeoutDelay(delay);
	}
	return delay;
};
