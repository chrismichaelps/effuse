import { TaggedError } from '@effuse/core';

export class FormSubmissionError extends TaggedError('FormSubmissionError')<{
	readonly message: string;
	readonly formId?: string;
	readonly field?: string;
	readonly cause?: unknown;
}> {
	override toString(): string {
		const fieldPart = this.field !== undefined ? ` (field: ${this.field})` : '';
		return `${this._tag}${fieldPart}: ${this.message}`;
	}
}
