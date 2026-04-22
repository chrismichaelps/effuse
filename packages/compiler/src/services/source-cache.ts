/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { PerformanceThresholds } from '../constants/index.js';

export { createContentHash } from '../utils/index.js';

interface CacheEntry<T> {
	readonly value: T;
	readonly timestamp: number;
	readonly lastAccessed: number;
	readonly hash: string;
}

export class SourceCache {
	private cache = new Map<string, CacheEntry<unknown>>();
	private hits = 0;
	private misses = 0;

	private isExpired(entry: CacheEntry<unknown>): boolean {
		return Date.now() - entry.timestamp > PerformanceThresholds.CACHE_TTL_MS;
	}

	get<T>(key: string, contentHash: string): T | null {
		const entry = this.cache.get(key) as CacheEntry<T> | undefined;

		if (!entry) {
			this.misses++;
			return null;
		}

		if (entry.hash !== contentHash || this.isExpired(entry)) {
			this.misses++;
			return null;
		}

		this.hits++;
		// Move to end of Map to maintain LRU insertion order
		this.cache.delete(key);
		this.cache.set(key, { ...entry, lastAccessed: Date.now() });
		return entry.value;
	}

	set<T>(key: string, contentHash: string, value: T): void {
		const now = Date.now();
		const entry: CacheEntry<T> = {
			value,
			timestamp: now,
			lastAccessed: now,
			hash: contentHash,
		};
		this.cache.set(key, entry);

		while (this.cache.size > PerformanceThresholds.MAX_CACHE_ENTRIES) {
			const oldestKey = this.cache.keys().next().value as string | undefined;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			} else {
				break;
			}
		}
	}

	invalidate(key: string): void {
		this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	stats(): { size: number; hits: number; misses: number } {
		return { size: this.cache.size, hits: this.hits, misses: this.misses };
	}
}
