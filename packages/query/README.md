<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  Effuse Query handles loading, caching, and synchronizing server state. It provides reactive hooks for data fetching with built-in reliability.
</p>

## Server Request Ownership

Create a `QueryClient` for each server request and provide it to that request's
component tree. Do not keep an authenticated server query client in a module
singleton: ordinary keys such as `['current-user']` do not identify a tenant.

Effuse deduplicates work inside the owning client or execution batch. Standalone
query executions are isolated by default, so unrelated requests cannot share an
in-flight promise merely because their keys match.
