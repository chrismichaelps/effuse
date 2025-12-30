/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { getGlobalTracing } from './global.js';

export const traceNavigation = (
  to: string,
  from: string,
  params?: Record<string, string>,
  duration?: number
): void => {
  const tracing = getGlobalTracing();
  if (!tracing?.isCategoryEnabled('router')) return;

  const data: Record<string, unknown> = {
    from,
    to,
  };
  if (params && Object.keys(params).length > 0) {
    data['params'] = params;
  }

  if (duration !== undefined) {
    tracing.logWithDuration('router', 'navigation', to, duration, data);
  } else {
    tracing.log('router', 'navigation', to, data);
  }
};

export interface RouterTraceData {
  readonly from?: string;
  readonly to: string;
  readonly params?: Record<string, string>;
  readonly query?: Record<string, string>;
}

export interface GuardTraceData {
  readonly guard: string;
  readonly result: 'allowed' | 'blocked' | 'redirect';
  readonly redirectTo?: string;
}

export const traceGuard = (
  guard: string,
  result: 'allowed' | 'blocked' | 'redirect',
  redirectTo?: string,
  duration?: number
): void => {
  const tracing = getGlobalTracing();
  if (!tracing?.isCategoryEnabled('router')) return;

  const logData: Record<string, unknown> = { result };
  if (redirectTo) {
    logData['redirectTo'] = redirectTo;
  }

  if (duration !== undefined) {
    tracing.logWithDuration('router', 'guard', guard, duration, logData);
  } else {
    tracing.log('router', 'guard', guard, logData);
  }
};

export const traceRouteMatch = (route: string, pattern: string): void => {
  const tracing = getGlobalTracing();
  if (!tracing?.isCategoryEnabled('router')) return;

  tracing.log('router', 'match', route, { pattern });
};
