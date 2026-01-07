import { TaggedError } from '@effuse/core';

export class NetworkError extends TaggedError('NetworkError')<{
	readonly message: string;
	readonly url: string;
	readonly status?: number;
	readonly cause?: unknown;
}> {
	override toString(): string {
		const statusPart = this.status !== undefined ? ` (${this.status})` : '';
		return `${this._tag}${statusPart}: ${this.message} - ${this.url}`;
	}
}
