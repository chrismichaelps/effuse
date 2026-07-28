import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLocalStorage, useSessionStorage } from '../../hooks/useStorage.js';

const createMockStorage = () => {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => store.set(key, value),
		removeItem: (key: string) => store.delete(key),
		clear: () => store.clear(),
		get length() {
			return store.size;
		},
		key: (index: number) => Array.from(store.keys())[index] ?? null,
	} as Storage;
};

describe('useLocalStorage', () => {
	let mockStorage: Storage;

	beforeEach(() => {
		mockStorage = createMockStorage();
		vi.stubGlobal('localStorage', mockStorage);
		vi.stubGlobal('window', { localStorage: mockStorage, addEventListener: vi.fn(), removeEventListener: vi.fn() });
	});

	it('should read initial value when storage is empty', () => {
		const { value } = useLocalStorage('test-key', 'default');
		expect(value.value).toBe('default');
	});

	it('should read existing value from localStorage', () => {
		mockStorage.setItem('test-key', JSON.stringify('stored'));
		const { value } = useLocalStorage('test-key', 'default');
		expect(value.value).toBe('stored');
	});

	it('should write value to localStorage', () => {
		const { setValue } = useLocalStorage('test-key', 'default');
		setValue('updated');
		expect(mockStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
	});

	it('should update signal when setValue is called', () => {
		const { value, setValue } = useLocalStorage('test-key', 'default');
		setValue('updated');
		expect(value.value).toBe('updated');
	});

	it('should use custom serializer and deserializer', () => {
		const { value, setValue } = useLocalStorage('test-key', 0, {
			serialize: (v) => String(v),
			deserialize: (raw) => parseInt(raw, 10),
		});
		expect(value.value).toBe(0);
		setValue(42);
		expect(mockStorage.getItem('test-key')).toBe('42');
		expect(value.value).toBe(42);
	});

	it('should handle storage events from other tabs', () => {
		const { value } = useLocalStorage('sync-key', 'a');
		expect(value.value).toBe('a');

		const handler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
			(call) => call[0] === 'storage'
		)?.[1];

		expect(handler).toBeDefined();
		handler({ key: 'sync-key', newValue: JSON.stringify('b') } as StorageEvent);

		expect(value.value).toBe('b');
	});

	it('should ignore storage events for other keys', () => {
		const { value } = useLocalStorage('my-key', 'a');

		const handler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
			(call) => call[0] === 'storage'
		)?.[1];

		handler({ key: 'other-key', newValue: JSON.stringify('b') } as StorageEvent);
		expect(value.value).toBe('a');
	});

	it('should expose idempotent cleanup for standalone ownership', () => {
		const setItem = vi.spyOn(mockStorage, 'setItem');
		const result = useLocalStorage('owned-key', 'a');

		result.dispose();
		result.dispose();
		expect(window.removeEventListener).toHaveBeenCalledTimes(1);
		result.setValue('b');
		expect(setItem).not.toHaveBeenCalled();
		expect(result.value.value).toBe('b');
	});
});

describe('useSessionStorage', () => {
	let mockStorage: Storage;

	beforeEach(() => {
		mockStorage = createMockStorage();
		vi.stubGlobal('sessionStorage', mockStorage);
		vi.stubGlobal('window', { sessionStorage: mockStorage, addEventListener: vi.fn(), removeEventListener: vi.fn() });
	});

	it('should read and write to sessionStorage', () => {
		const { value, setValue } = useSessionStorage('sess-key', 10);
		expect(value.value).toBe(10);
		setValue(20);
		expect(mockStorage.getItem('sess-key')).toBe(JSON.stringify(20));
		expect(value.value).toBe(20);
	});
});
