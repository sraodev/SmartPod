# Local read-only gateway preview

Implemented: one Go process, one deterministic simulator, SQLite persistence, and
two authenticated read endpoints. No hardware, GPIO, output commands, payments,
browser-lab integration, session API, event stream, or public listener. Synthetic
`closed` output is **not physical feedback**; readings are estimates, not billable energy.
The existing electrical-safety and billing restrictions remain unchanged.

## Build and run

Requires Go 1.25 or newer. From the repository root:

```sh
cd gateway
go build -o build/smartpod-gateway .
export SMARTPOD_GATEWAY_TOKEN="$(openssl rand -hex 32)"
./build/smartpod-gateway -db smartpod-gateway.db
```

The default listener is `127.0.0.1:8080`. Use `-listen 127.0.0.1:8081` to change the
port, or `-listen '[::1]:8080'` for IPv6 loopback. Only numeric loopback addresses
are accepted; hostnames, wildcard listeners, and LAN/public addresses are rejected.
`-help` works without a token. The token must be 32–256 printable non-space ASCII
characters; generate it randomly, do not use the test token. It is read only from
the environment, never stored in SQLite or printed in logs.

From another shell with the same token available, query the API. Avoid placing
the token in command-line arguments; this curl configuration is read from stdin:

```sh
printf 'header = "Authorization: Bearer %s"\n' "$SMARTPOD_GATEWAY_TOKEN" |
  curl --fail --silent --show-error --config - http://127.0.0.1:8080/api/v1/ports
printf 'header = "Authorization: Bearer %s"\n' "$SMARTPOD_GATEWAY_TOKEN" |
  curl --fail --silent --show-error --config - http://127.0.0.1:8080/api/v1/ports/sim-port-1
```

Use Ctrl-C or SIGTERM for graceful shutdown: the sampler stops, HTTP requests
drain (up to five seconds), then SQLite closes. Restart with the same database
filename to resume the persisted sequence and energy, not a new seed. The token
may be changed on restart; no token/session credentials are persisted.

## API and security boundary

Paths and schemas are in [openapi-v2.yaml](openapi-v2.yaml). Requests require the
configured bearer token. Unknown ports/routes return 404, missing/incorrect auth
returns 401, non-GET requests to supported routes return 405, and storage read
failures return 503. Errors use `application/problem+json` without raw storage
details. There is no health endpoint; an authenticated port-list GET checks the
same read path clients use. Responses set `Cache-Control: no-store`.

This is a **same-user, trusted-machine development preview**, not remote access:

- Listener validation forbids non-loopback exposure. Requests must also use the
  exact numeric listener address and port as Host; rebinding hosts return 403.
- Browser Origin headers and cross-site Fetch Metadata requests are rejected.
  There is no CORS support. A later browser integration needs its own origin policy.
- No proxy forwarding headers are trusted. Do not publish it through a reverse
  proxy, port forwarding, or a tunnel; doing so bypasses the local-only boundary.
- Loopback HTTP is not TLS. Local privileged processes can inspect environment
  variables or traffic. Use only generated development tokens, never production
  credentials. There is no multi-user authorization or rate-limiting claim.
- Logs contain lifecycle messages, the loopback address, and simulator mode.
  Authorization headers, tokens, request bodies, and query strings are not logged.

Non-loopback exposure requires an explicit design and review of TLS, identity,
token lifecycle, authorization, origin/Host policy, request limits, and operational
threats. There is deliberately no `--unsafe-public` option in this preview.

## Simulator and storage

The single `sim-port-1` fixture replays a constant estimated 360 W load at 230,000 mV
and 1,565 mA (rounded independently). It reports `active` with explicitly synthetic
`closed` output, empty faults, and no linked session. It does not create a session
record or charge. The gateway fixture is independent of the browser's sine-wave demo.

The seed reading has sequence 0 and zero energy. Each sampler tick appends a row,
incrementing sequence by one and energy by **100 milli-Wh**. The source integer is
durable; the API exposes `floor(energy_milliwh / 1000)` Wh without changing it.
This follows [the contract boundary](simulator-contract.md). `quality` is always
`estimated`. Timestamps replay from **2026-01-01T00:00:00Z**, one synthetic second
per sequence; they are not wall-clock freshness indicators. Downtime is not
backfilled. A stalled process slows replay rather than estimating missed energy.

SQLite stores port metadata and readings keyed by `(port_id, sequence)`. Every
append is transactional; reads select the latest committed row in sequence order.
The one-connection pool and primary key prevent partially published or overwritten
readings. Run one gateway process per database. The file uses SQLite's default
rollback journal; no separate server or in-memory fallback exists.

### Single migration path

`gateway/store.go` owns migrations. On startup, an integrity check runs, then a
transaction inspects SQLite's `PRAGMA user_version`:

1. Version 0 with no existing user objects: create schema and seed rows, set version 1,
   and commit atomically. A nonempty unversioned database is rejected.
2. Version 1: verify preview metadata and seed presence; do not reseed or overwrite history.
3. Any other version: refuse startup. Future changes must add an ordered migration
   in this same transaction and tests from the previous version. No auto-downgrades.

Use a dedicated writable local directory. Parents are not created automatically;
new database files are mode 0600. Existing file permissions are not changed. Keep
it out of Git. This preview retains every reading and has no retention/compaction
policy; monitor local disk use. The deterministic replay stops after ten synthetic
years rather than overflowing its supported timestamp/sequence range.

Corrupt/unavailable storage fails startup. A later write failure stops the process
with a nonzero exit; a read failure returns 503 while the process is still running.
Neither path silently replaces the file or resets the counter. Stop the process
before backing up or restoring the database (including any remaining journal).
Preserve a corrupt file for diagnosis; restore a known-good backup. To intentionally
start a new disposable replay, choose a **new filename**, not a forced migration.

SQLite semantics: [PRAGMA documentation](https://www.sqlite.org/pragma.html).
The pinned [pure-Go SQLite driver](https://pkg.go.dev/modernc.org/sqlite) avoids a
C cross-compiler for the supported Linux build targets.

## Verification

```sh
cd gateway
go test -race ./...
go vet ./...
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o build/smartpod-gateway-linux-amd64 .
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -o build/smartpod-gateway-linux-arm64 .
cd ..
npm --prefix interface ci
node scripts/test-gateway-contract.cjs
```

The last check builds and starts a real local process, checks authenticated reads
and error responses against OpenAPI via the existing validator, verifies SIGTERM
and restart continuity, and checks token-free logs. Go tests additionally cover
ordered history/remainders, migration/restart, corrupt and locked storage,
runtime write failures, auth, Host/origin rejection, and read-only routing.

CI requires these checks and Linux amd64/arm64 cross-builds. Cross-compilation is
**not Raspberry Pi runtime validation**. No hardware, real meter, load switching,
revenue-grade billing, or payment validation was performed. The gateway binary is
not the future `smartpod` CLI and must not be packaged as an installer CLI asset.
