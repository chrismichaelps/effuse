export * from './network.js';
export * from './api.js';
export * from './todo.js';
export * from './form.js';

import type { NetworkError } from './network.js';
import type { ApiError } from './api.js';
import type { TodoError } from './todo.js';
import type { FormSubmissionError } from './form.js';

export type AppError =
	| NetworkError
	| ApiError
	| TodoError
	| FormSubmissionError;
