export * from './network.js';
export * from './api.js';
export * from './todo.js';
export * from './form.js';
export * from './search.js';

import type { NetworkError } from './network.js';
import type { ApiError } from './api.js';
import type { TodoError } from './todo.js';
import type { FormSubmissionError } from './form.js';
import type { SearchUIError, SearchIndexError } from './search.js';

export type AppError =
	| NetworkError
	| ApiError
	| TodoError
	| FormSubmissionError
	| SearchUIError
	| SearchIndexError;
