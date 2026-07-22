import { defineHook, type ReadonlySignal } from '@effuse/core';
import { isClient } from '../../internal/utils.js';
import { ClipboardError } from './errors.js';
import { traceClipboard } from './telemetry.js';

export {
	ClipboardError,
	type ClipboardErrorCode,
	type ClipboardOperation,
} from './errors.js';

export type ClipboardPermissionState = PermissionState | 'unknown' | 'unsupported';

export interface ClipboardPermissions {
	readonly read: ClipboardPermissionState;
	readonly write: ClipboardPermissionState;
}

export interface UseClipboardConfig {
	readonly copiedDuration?: number;
	readonly queryPermissions?: boolean;
}

export interface UseClipboardReturn {
	readonly canRead: ReadonlySignal<boolean>;
	readonly canWrite: ReadonlySignal<boolean>;
	readonly isSupported: ReadonlySignal<boolean>;
	readonly permissions: ReadonlySignal<ClipboardPermissions>;
	readonly copied: ReadonlySignal<boolean>;
	readonly text: ReadonlySignal<string | null>;
	readonly error: ReadonlySignal<ClipboardError | null>;
	readonly copy: (text: string) => Promise<boolean>;
	readonly read: () => Promise<string | null>;
	readonly reset: () => void;
}

const DEFAULT_COPIED_DURATION_MS = 1_500;

interface ClipboardNavigator {
	readonly clipboard?: Pick<Clipboard, 'readText' | 'writeText'>;
	readonly permissions?: Permissions;
}

const getClipboardNavigator = (): ClipboardNavigator | undefined =>
	typeof navigator === 'undefined'
		? undefined
		: (navigator as unknown as ClipboardNavigator);

export const useClipboard = defineHook<
	UseClipboardConfig | undefined,
	UseClipboardReturn
>({
	name: 'useClipboard',
	setup: (ctx) => {
		const copiedDuration =
			ctx.config?.copiedDuration ?? DEFAULT_COPIED_DURATION_MS;
		const queryPermissions = ctx.config?.queryPermissions ?? true;
		if (!Number.isFinite(copiedDuration) || copiedDuration < 0) {
			throw new ClipboardError(
				'INVALID_DURATION',
				'config',
				`Copied duration must be finite and >= 0; received ${String(copiedDuration)}`
			);
		}

		const readable = ctx.signal(false);
		const writable = ctx.signal(false);
		const permissions = ctx.signal<ClipboardPermissions>({
			read: 'unsupported',
			write: 'unsupported',
		});
		const copied = ctx.signal(false);
		const text = ctx.signal<string | null>(null);
		const error = ctx.signal<ClipboardError | null>(null);
		const supported = ctx.computed(() => readable.value || writable.value);
		let copiedTimer: ReturnType<typeof setTimeout> | null = null;
		let disposed = false;
		let writeRequest = 0;
		let readRequest = 0;
		const permissionCleanups: Array<() => void> = [];
		const isDisposed = (): boolean => disposed;

		traceClipboard('init', {
			'clipboard.query_permissions': queryPermissions,
		});

		const clearCopiedTimer = (): void => {
			if (copiedTimer !== null) {
				clearTimeout(copiedTimer);
				copiedTimer = null;
			}
		};

		const setPermission = (
			kind: 'read' | 'write',
			state: ClipboardPermissionState
		): void => {
			permissions.value = { ...permissions.value, [kind]: state };
			traceClipboard('permission', {
				'clipboard.permission': kind,
				'clipboard.state': state,
			});
		};

		const setOperationError = (nextError: ClipboardError): void => {
			if (disposed) return;
			error.value = nextError;
			traceClipboard('error', {
				'clipboard.code': nextError.code,
				'clipboard.operation': nextError.operation,
			});
		};

		const queryPermission = async (
			kind: 'read' | 'write',
			permissionApi: Permissions
		): Promise<void> => {
			try {
				const status = await permissionApi.query({
					name: `clipboard-${kind}` as PermissionName,
				});
				if (isDisposed()) return;
				const synchronize = (): void => {
					setPermission(kind, status.state);
				};
				synchronize();
				status.addEventListener('change', synchronize);
				permissionCleanups.push(() => {
					status.removeEventListener('change', synchronize);
				});
			} catch (cause) {
				if (isDisposed()) return;
				setPermission(kind, 'unknown');
				setOperationError(
					new ClipboardError(
						'PERMISSION_QUERY_FAILED',
						'permission',
						`Could not query clipboard ${kind} permission`,
						{ cause }
					)
				);
			}
		};

		const reset = (): void => {
			clearCopiedTimer();
			copied.value = false;
			error.value = null;
		};

		const copy = async (nextText: string): Promise<boolean> => {
			const request = ++writeRequest;
			const clipboard = getClipboardNavigator()?.clipboard;
			if (
				isDisposed() ||
				!writable.value ||
				typeof clipboard?.writeText !== 'function'
			) {
				setOperationError(
					new ClipboardError(
						'UNSUPPORTED',
						'write',
						'Clipboard writing is not supported'
					)
				);
				return false;
			}
			if (permissions.value.write === 'denied') {
				setOperationError(
					new ClipboardError(
						'PERMISSION_DENIED',
						'write',
						'Clipboard write permission is denied'
					)
				);
				return false;
			}

			try {
				await clipboard.writeText(nextText);
				if (isDisposed() || request !== writeRequest) return true;
				clearCopiedTimer();
				text.value = nextText;
				copied.value = true;
				error.value = null;
				traceClipboard('write');
				copiedTimer = setTimeout(() => {
					copiedTimer = null;
					if (!isDisposed()) copied.value = false;
				}, copiedDuration);
				return true;
			} catch (cause) {
				if (request === writeRequest) {
					setOperationError(
						new ClipboardError('WRITE_FAILED', 'write', 'Clipboard write failed', {
							cause,
						})
					);
				}
				return false;
			}
		};

		const read = async (): Promise<string | null> => {
			const request = ++readRequest;
			const clipboard = getClipboardNavigator()?.clipboard;
			if (
				isDisposed() ||
				!readable.value ||
				typeof clipboard?.readText !== 'function'
			) {
				setOperationError(
					new ClipboardError(
						'UNSUPPORTED',
						'read',
						'Clipboard reading is not supported'
					)
				);
				return null;
			}
			if (permissions.value.read === 'denied') {
				setOperationError(
					new ClipboardError(
						'PERMISSION_DENIED',
						'read',
						'Clipboard read permission is denied'
					)
				);
				return null;
			}

			try {
				const nextText = await clipboard.readText();
				if (!isDisposed() && request === readRequest) {
					text.value = nextText;
					error.value = null;
					traceClipboard('read');
				}
				return nextText;
			} catch (cause) {
				if (request === readRequest) {
					setOperationError(
						new ClipboardError('READ_FAILED', 'read', 'Clipboard read failed', {
							cause,
						})
					);
				}
				return null;
			}
		};

		ctx.onMount(() => {
			if (!isClient()) return undefined;
			const runtimeNavigator = getClipboardNavigator();
			if (!runtimeNavigator) return undefined;
			const clipboard = runtimeNavigator.clipboard;
			readable.value = typeof clipboard?.readText === 'function';
			writable.value = typeof clipboard?.writeText === 'function';
			permissions.value = {
				read: readable.value ? 'unknown' : 'unsupported',
				write: writable.value ? 'unknown' : 'unsupported',
			};

			if (queryPermissions && runtimeNavigator.permissions) {
				if (readable.value) {
					void queryPermission('read', runtimeNavigator.permissions);
				}
				if (writable.value) {
					void queryPermission('write', runtimeNavigator.permissions);
				}
			}

			return () => {
				disposed = true;
				writeRequest += 1;
				readRequest += 1;
				clearCopiedTimer();
				for (const cleanup of permissionCleanups.splice(0)) cleanup();
			};
		});

		return {
			canRead: readable,
			canWrite: writable,
			isSupported: supported,
			permissions,
			copied,
			text,
			error,
			copy,
			read,
			reset,
		};
	},
});
