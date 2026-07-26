<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  The core library for Effuse. It provides the reactive Signals engine and the lightweight DOM renderer, serving as the foundation for building interactive interfaces.
</p>

## Framework Direction

Effuse core is moving toward a capability-first framework model: typed layers,
local layer aliases in `define({ script })`, shared hook/component layer DX, and
layer-owned server APIs/actions with client-side action helpers and server
manifests for typed clients. Server handlers also receive validation helpers for
params, query, headers, JSON bodies, and form data so request contracts live next
to the layer that owns the capability. Typed server errors can be returned with
`ctx.response.error`, thrown with `LayerServerError`, and narrowed from action
clients through `LayerActionError<T>`.
Layer-owned server routes and actions can also declare middleware plus cache,
CORS, runtime, region, and duration metadata that flows into responses and the
server manifest.

Read the detailed proposal in [FRAMEWORK_DX_PROPOSAL.md](./FRAMEWORK_DX_PROPOSAL.md).
