import { TaggedError } from '@effuse/core';

export class ApiError extends TaggedError('ApiError')<{
	readonly message: string;
	readonly endpoint: string;
	readonly statusCode: number;
	readonly body?: unknown;
}> {
	override toString(): string {
		return `${this._tag} [${this.statusCode}] ${this.endpoint}: ${this.message}`;
	}

	override toJSON(): Record<string, unknown> {
		return {
			_tag: this._tag,
			message: this.message,
			endpoint: this.endpoint,
			statusCode: this.statusCode,
			body: this.body,
		};
	}
}
