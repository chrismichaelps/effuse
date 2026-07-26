<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

# @effuse/server

Portable Web `Request`/`Response` server runtime for [Effuse](https://github.com/chrismichaelps/effuse), with reference **Node** and **Bun** adapters and a shared conformance suite.

An Effuse app produces a single Web-standard fetch handler (`(request: Request) => Promise<Response>`). This package turns that handler into a real, listening server on any conforming runtime — without changing a line of application code.

## Install

```bash
pnpm add @effuse/server
```

## Usage

```ts
import { createNodeServer } from '@effuse/server/node';
import { handleRequest } from './entry-server.js'; // your Effuse fetch handler

const server = createNodeServer(handleRequest, { maxBodyBytes: 5 * 1024 * 1024 });
const { url } = await server.listen({ port: 3000 });
console.log(`Listening on ${url}`);

// Graceful shutdown drains in-flight requests, then force-closes.
process.on('SIGTERM', () => void server.close());
```

The Bun adapter is a drop-in replacement:

```ts
import { createBunServer } from '@effuse/server/bun';

const server = createBunServer(handleRequest);
await server.listen({ port: 3000 });
```

## The contract

Every adapter implements the same [`EffuseServer`](./src/contract.ts) surface:

| Member | Purpose |
| --- | --- |
| `listen(options?)` | Bind host/port (`port: 0` = ephemeral). Resolves the bound address. |
| `fetch(request)` | Invoke the handler in-process, with no socket — for tests, SSR, and health checks. |
| `close(options?)` | Stop accepting, drain in-flight requests within `timeoutMs`, then force-close. |
| `address` | The bound `{ host, port, url }`, or `null` before `listen`. |
| `runtime` | `'node'` or `'bun'`. |

`ServerOptions` covers `maxBodyBytes` (oversize bodies get a stable `413`, never buffered past the limit) and `onError` (invoked before the `500` envelope when a handler throws).

## Runtime compatibility

See [CAPABILITIES.md](./CAPABILITIES.md) — generated from the tested matrix. Node and Bun both pass the full conformance suite (streaming, request cancellation, graceful shutdown, multipart, multiple `Set-Cookie`, ephemeral ports).

## Conformance

The suite in [`src/conformance.ts`](./src/conformance.ts) is runtime-agnostic and reusable. Downstream (edge/vendor) adapters can validate themselves against it:

```ts
import { runConformance } from '@effuse/server';
import { describe, it, expect } from 'vitest';
import { myEdgeAdapter } from './my-edge-adapter.js';

runConformance(myEdgeAdapter, { describe, it, expect });
```

- Node suite: `pnpm --filter @effuse/server test`
- Bun suite: `pnpm --filter @effuse/server test:bun` (self-skips when Bun is absent)

## License

MIT © Chris M. Pérez
