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

## Entrypoints

| Import                | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `@effuse/server`      | Portable contract, storage, server helpers, and conformance suite. |
| `@effuse/server/node` | Node HTTP adapter.                                                 |
| `@effuse/server/bun`  | Bun server adapter.                                                |

Adapter modules are server-only and must not be imported by browser entries.

## Usage

```ts
import { createNodeServer } from '@effuse/server/node';
import { handleRequest } from './entry-server.js'; // your Effuse fetch handler

const server = createNodeServer(handleRequest, {
	maxBodyBytes: 5 * 1024 * 1024,
});
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

Effuse CLI production builds wire the generated listener to `dist/client`
automatically. Custom listeners can serve an immutable client build with the
same runtime adapter:

```ts
import { createNodeServer, withStaticFiles } from '@effuse/server/node';
import { handleRequest } from './entry-server.js';

const handler = withStaticFiles(handleRequest, {
	root: new URL('../client/', import.meta.url),
});
const server = createNodeServer(handler);
await server.listen({ port: 3000 });
```

`withStaticFiles` handles `GET` and `HEAD`, validators, content types, and
immutable caching for hashed `/assets/` files. Missing files and application
routes fall through to the wrapped handler. `/api` and `/_effuse` remain
reserved for server routes and actions. File resolution is contained to the
configured real path, including when symbolic links are present.

## The contract

Every adapter implements the same [`EffuseServer`](./src/contract.ts) surface:

| Member             | Purpose                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `listen(options?)` | Bind host/port (`port: 0` = ephemeral). Resolves the bound address.                |
| `fetch(request)`   | Invoke the handler in-process, with no socket — for tests, SSR, and health checks. |
| `close(options?)`  | Stop accepting, drain in-flight requests within `timeoutMs`, then force-close.     |
| `address`          | The bound `{ host, port, url }`, or `null` before `listen`.                        |
| `runtime`          | `'node'` or `'bun'`.                                                               |

`ServerOptions` covers `maxBodyBytes` (oversize bodies get a stable `413`, never buffered past the limit) and `onError` (invoked before the `500` envelope when a handler throws).

## Production Operation

- Set an explicit request-body limit appropriate for the application.
- Apply process signal handling and await `close()` during deployment shutdown.
- Use `fetch(request)` for deterministic in-process probes without opening a
  second socket.
- Surface `onError` to structured logging while keeping the public `500`
  response free of internal error details.
- Put proxy trust, TLS termination, connection limits, and abuse controls at the
  deployment boundary appropriate to the selected runtime.

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
