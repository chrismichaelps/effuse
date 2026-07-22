import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClipboard } from './index.js';

class MockPermissionStatus extends EventTarget {
	constructor(public state: PermissionState) {
		super();
	}
}

describe('useClipboard', () => {
	let writeText: ReturnType<typeof vi.fn>;
	let readText: ReturnType<typeof vi.fn>;
	let readPermission: MockPermissionStatus;
	let writePermission: MockPermissionStatus;
	let query: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		writeText = vi.fn().mockResolvedValue(undefined);
		readText = vi.fn().mockResolvedValue('clipboard text');
		readPermission = new MockPermissionStatus('prompt');
		writePermission = new MockPermissionStatus('granted');
		query = vi.fn(({ name }: PermissionDescriptor) =>
			Promise.resolve(
				String(name).endsWith('read') ? readPermission : writePermission
			)
		);
		vi.stubGlobal('window', {});
		vi.stubGlobal('document', {});
		vi.stubGlobal('navigator', {
			clipboard: { writeText, readText },
			permissions: { query },
		});
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('detects independent capabilities and permission states', async () => {
		const clipboard = useClipboard();
		await Promise.resolve();

		expect(clipboard.canRead.value).toBe(true);
		expect(clipboard.canWrite.value).toBe(true);
		expect(clipboard.isSupported.value).toBe(true);
		expect(clipboard.permissions.value).toEqual({
			read: 'prompt',
			write: 'granted',
		});

		writePermission.state = 'denied';
		writePermission.dispatchEvent(new Event('change'));
		expect(clipboard.permissions.value.write).toBe('denied');
	});

	it('writes text and resets copied state after the configured duration', async () => {
		const clipboard = useClipboard({
			copiedDuration: 100,
			queryPermissions: false,
		});

		await expect(clipboard.copy('Effuse')).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith('Effuse');
		expect(clipboard.text.value).toBe('Effuse');
		expect(clipboard.copied.value).toBe(true);
		vi.advanceTimersByTime(100);
		expect(clipboard.copied.value).toBe(false);
	});

	it('reads text without rejecting', async () => {
		const clipboard = useClipboard({ queryPermissions: false });

		await expect(clipboard.read()).resolves.toBe('clipboard text');
		expect(clipboard.text.value).toBe('clipboard text');
		expect(clipboard.error.value).toBeNull();
	});

	it('captures write and read failures as typed state', async () => {
		const writeCause = new Error('write rejected');
		writeText.mockRejectedValue(writeCause);
		const clipboard = useClipboard({ queryPermissions: false });

		await expect(clipboard.copy('Effuse')).resolves.toBe(false);
		expect(clipboard.error.value).toMatchObject({
			code: 'WRITE_FAILED',
			operation: 'write',
			cause: writeCause,
		});

		const readCause = new Error('read rejected');
		readText.mockRejectedValue(readCause);
		await expect(clipboard.read()).resolves.toBeNull();
		expect(clipboard.error.value).toMatchObject({
			code: 'READ_FAILED',
			operation: 'read',
			cause: readCause,
		});
	});

	it('does not call the API when permission is denied', async () => {
		writePermission.state = 'denied';
		const clipboard = useClipboard();
		await Promise.resolve();

		await expect(clipboard.copy('blocked')).resolves.toBe(false);
		expect(writeText).not.toHaveBeenCalled();
		expect(clipboard.error.value?.code).toBe('PERMISSION_DENIED');
	});

	it('keeps operations available when permission querying fails', async () => {
		query.mockRejectedValue(new Error('query unsupported'));
		const clipboard = useClipboard();
		await Promise.resolve();
		await Promise.resolve();

		expect(clipboard.permissions.value).toEqual({
			read: 'unknown',
			write: 'unknown',
		});
		expect(clipboard.error.value?.code).toBe('PERMISSION_QUERY_FAILED');
		await expect(clipboard.copy('still works')).resolves.toBe(true);
		expect(clipboard.error.value).toBeNull();
	});

	it('represents SSR and missing clipboard APIs as unsupported', async () => {
		vi.stubGlobal('window', undefined);
		vi.stubGlobal('document', undefined);
		vi.stubGlobal('navigator', undefined);
		const clipboard = useClipboard();

		expect(clipboard.isSupported.value).toBe(false);
		await expect(clipboard.copy('no browser')).resolves.toBe(false);
		expect(clipboard.error.value?.code).toBe('UNSUPPORTED');
	});

	it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
		'rejects invalid copied duration %s',
		(copiedDuration) => {
			expect(() => useClipboard({ copiedDuration })).toThrowError(
				expect.objectContaining({ code: 'INVALID_DURATION' })
			);
		}
	);
});
