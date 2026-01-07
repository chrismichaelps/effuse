import { TaggedError } from '@effuse/core';

export class SearchUIError extends TaggedError('SearchUIError')<{
	readonly message: string;
	readonly query?: string;
	readonly cause?: unknown;
}> {
	override toString(): string {
		const queryPart = this.query ? ` for "${this.query}"` : '';
		return `${this._tag}: ${this.message}${queryPart}`;
	}
}

export class SearchIndexError extends TaggedError('SearchIndexError')<{
	readonly message: string;
	readonly documentPath?: string;
	readonly cause?: unknown;
}> {
	override toString(): string {
		const pathPart = this.documentPath ? ` (${this.documentPath})` : '';
		return `${this._tag}: ${this.message}${pathPart}`;
	}
}
