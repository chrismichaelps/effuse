import { Data } from 'effect';

export class HookLayerNotReadyError extends Data.TaggedError('HookLayerNotReadyError')<{
  readonly hookContext: string;
  readonly layerName: string;
}> {
  get message(): string {
    return (
      `[defineHook] Cannot access layer "${this.layerName}" - layer runtime not initialized. ` +
      `Ensure hooks using ${this.hookContext}() are called within mounted components.`
    );
  }
}

export type HookError = HookLayerNotReadyError;
