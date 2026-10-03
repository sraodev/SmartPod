# Simulator-to-gateway contract boundary

Status: implemented **read-only projection and fixtures**, not a gateway or UI integration.
The browser lab has no physical output feedback, authoritative meter, or payment provider.
The existing safety and billing disclosures still apply. This work does not authorize mains
operation, real-money charging, or production use.

[`projectSimulatorContract`](../interface/src/simulator/gatewayContract.js) accepts the
lab's `sessionState`, `energyMilliWh`, and optional explicit `actualOutput`. It returns
contract fragments (`port_state`, nullable `session_state`, `actual_output`, `energy_wh`)
plus local `energy_remainder_milliwh`. These are **not** a complete API response: the
future gateway must supply identity, timestamps, sequence, measurement quality, faults,
tariff snapshot, and session history. Do not send the local remainder as an extra property
on the closed OpenAPI `Measurement` schema.

## Energy and pricing

- The lab accumulates non-negative integer **milli-Wh**, not Wh. One Wh is 1,000 milli-Wh;
  one kWh is 1,000,000 milli-Wh. The projection rejects fractional, negative, nonnumeric,
  or unsafe integer energy inputs instead of coercing them.
- At the API/display boundary only: `energy_wh = floor(energyMilliWh / 1000)` and
  `energy_remainder_milliwh = energyMilliWh % 1000`. The remainder is 0–999, so
  `energy_wh * 1000 + energy_remainder_milliwh` reconstructs the source exactly.
- Keep the original milli-Wh accumulator across ticks. Never replace it with the whole-Wh
  projection, round each tick to Wh, or add rounded UI samples to construct billable energy.
  This adapter does not change the lab's existing per-tick power-to-milli-Wh approximation.
- The lab resets its counter on each start/reset. Its example session starts at zero Wh;
  it is not a lifetime device meter. A future gateway must define meter epochs/reset
  handling and compare start/end readings from the same epoch.
- Pricing still uses the **original milli-Wh**, elapsed active seconds, and immutable
  session tariff. All money stays in integer minor units. Existing behavior rounds energy
  and time components with `Math.round` (half-up for non-negative values), then rounds tax
  on the rounded subtotal. Nothing here changes the engine or issue #5's pricing behavior.

The [OpenAPI examples](openapi-v2.yaml) describe 500,417 milli-Wh and 120 active seconds
under the default INR tariff. The projected meter value is 500 Wh with 417 milli-Wh retained
locally. Fixed/energy/time/tax/total are **500 / 601 / 40 / 205 / 1346** minor units.
Repricing from the truncated 500 Wh would incorrectly give 1345. Examples use
`mode: simulator`, `quality: estimated`, `charge.estimated: true`, and
`payment_state: not_required`; completion is not settlement. The browser estimate must
never be promoted to an authoritative future gateway/meter reading or receipt.

## State and actual-output mapping

| Simulator state | Port state | Session state | Actual output |
| --- | --- | --- | --- |
| `available` | `available` only with explicit `open`; otherwise `unavailable` | No current session (`null` fragment) | Supplied feedback, else `unknown` |
| `starting` | `energizing` | `energizing` | Supplied feedback, else `unknown` |
| `active` | `active` | `active` | Supplied feedback, else `unknown` |
| `stopping` | `stopping` | `stopping` | Supplied feedback, else `unknown` |
| `completed` | `available` only with explicit `open`; otherwise `unavailable` | `completed` | Supplied feedback, else `unknown` |
| `faulted` | `faulted` | `failed` | Supplied feedback, else `unknown` |

`null` means no Session resource, not a nullable `Session.state`. A completed or failed
session is historical, not `Port.active_session_id`; retain its record separately.
The simplified lab start skips authorization and preparation. Unsupported richer states
are port `authorizing`/`preparing` and session `authorizing`/`preparing`/`settled`.
`unavailable` is a conservative projection for uncertain reuse, not a new lab state.

Output feedback is independent of these states. `active` with `unknown` does not prove
power is flowing; `faulted` with `closed` must not be rewritten as `open`. Synthetic
feedback may be passed explicitly by a future simulator adapter, but must never be
represented as observed hardware feedback. Missing/stale/untrusted feedback must be
passed as `unknown`. The browser's timer transitions and output labels are not evidence.

| Event | Accepted source → destination | Projection / feedback rule |
| --- | --- | --- |
| `start_requested` | `available` or `completed` → `starting` | Port/session `energizing`; does not confirm closure |
| `output_confirmed` | `starting` → `active` | Port/session `active`; explicit synthetic `closed` may accompany the event |
| `stop_requested` | `active` → `stopping` | Port/session `stopping`; does not confirm opening |
| `output_opened` | `stopping` → `completed` | Session `completed`; port reusable only with explicit `open` |
| `fault_detected` | `starting`, `active`, or `stopping` → `faulted` | Port `faulted`, session `failed`; actual output still requires feedback |
| `reset` | Every lab state → `available` | No current session; reset does not prove output opened or clear a real hardware fault |

The projection does not apply events, control output, clear faults, or authorize starts.
Without accompanying feedback **every event still projects `unknown`**. The state machine
rejects all other event edges. A future gateway must enforce its own transition/fault
policy; a snapshot mapping is not that policy. The UI network toggle is not a session
event or feedback source, and must not imply stopped output or implement offline limits
(issue #17).

## Fixtures and verification

[JSON state fixtures](fixtures/simulator-state-mappings.json) are reusable by gateway #13.
The focused tests cover every current state/event edge, explicit and unknown feedback,
faults, completion, Wh/kWh boundaries, safe-integer limits, preserved accumulation, and
the example's unchanged pricing. They also check state enums against the draft schema.
The required CI build validates the OpenAPI structure and schema examples with
[Redocly lint](https://redocly.com/docs/cli/commands/lint); invalid examples are errors.

```sh
CI=true npm --prefix interface test
npx --yes @redocly/cli@2.49.0 lint docs/openapi-v2.yaml
```
