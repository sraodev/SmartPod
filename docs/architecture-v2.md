# SmartPod v2: open energy-control platform

Status: **proposed architecture**. This document is a contract for the next implementation, not a claim that the current ESP8266 prototype controls mains power or accepts payments.

## Product outcome

SmartPod v2 is a hardware-adaptable platform for a smart power port. A user can connect from a web/mobile app, see live electrical and session data, start or stop an authorized port, and understand the running charge.

The app should show:

- Port availability, actual switch/contactor state, and faults.
- Voltage, current, active power, cumulative energy, and elapsed time.
- The tariff snapshot used for this session.
- Fixed, energy, time, idle, tax, and total charge components.
- Payment authorization/capture state without exposing provider secrets.
- A clear stop control that remains available independently of payment state.

The platform can support three adapters without pretending they are equally safe:

1. **Simulator/low-voltage lab adapter** for development and CI.
2. **Smart-power adapter** using a properly rated, enclosed contactor and meter for a defined appliance class.
3. **AC EVSE adapter** using an established EVSE safety controller and the required pilot, protection, and contactor logic.

A household smart relay must not be presented as an EV charger. EV supply equipment is covered by electrical-safety requirements such as [IEC 61851-1](https://webstore.iec.ch/en/publication/33644); certification and installation rules depend on the target market.

## Architecture

```text
┌───────────────────────┐       HTTPS / WebSocket       ┌────────────────────────┐
│ React PWA / mobile UI │◄─────────────────────────────►│ SmartPod control plane │
└───────────────────────┘                               │ auth · tariffs · money │
                                                        │ fleet · payment adapter│
                                                        └───────────┬────────────┘
                                                                    │ mTLS / OCPP
                                                        ┌───────────▼────────────┐
                                                        │ Optional site gateway  │
                                                        │ Raspberry Pi / Linux   │
                                                        │ offline ledger · queue │
                                                        │ protocol adapters      │
                                                        └───────────┬────────────┘
                                                                    │ isolated
                                                               CAN / RS-485
                                                        ┌───────────▼────────────┐
                                                        │ Real-time controller   │
                                                        │ ESP32 / STM32 / RP2040 │
                                                        │ interlocks · watchdog  │
                                                        │ meter · actual switch  │
                                                        └───────────┬────────────┘
                                                                    │
                                          ┌─────────────────────────▼──────────────┐
                                          │ Meter · contactor · protection · port │
                                          └────────────────────────────────────────┘
```

The optional Linux gateway can run on a Raspberry Pi, industrial PC, or router-class device. It is supervisory: Linux, the app, and the payment provider never own the immediate safety loop.

## Responsibility boundaries

| Layer | Owns | Must not own |
| --- | --- | --- |
| Real-time controller | Interlocks, watchdog, actual output state, local stop, meter acquisition, over-temperature/current response | Card/payment secrets, tariff editing, cloud-only authorization |
| Site gateway | Device adapters, local API, offline session ledger, store-and-forward telemetry, OCPP client | Bypassing controller faults or directly forcing a contactor |
| Control plane | Users, sites, tariffs, signed session grants, fleet state, reconciliation, payment-provider adapters | A safety-critical promise that a remote command succeeded |
| App | Intent, live presentation, receipts, accessible stop action | Calculating authoritative charges or deciding actual electrical state |

## Hardware boundary

### Controller

Use an MCU for deterministic control. The first reference adapter can target an ESP32-S3 with ESP-IDF or Zephyr; the controller API must stay portable enough for STM32 or another supported MCU. A Raspberry Pi may host the gateway, but should not directly implement the only contactor-interlock or protection loop.

Production-capable controller requirements include:

- Independent watchdog and de-energized-on-fault outputs.
- Contactor driver plus auxiliary-contact/weld detection.
- Temperature, over-current, meter-loss, and communication-loss policies.
- Local emergency/stop input that cannot be blocked by cloud or payment state.
- Signed firmware, rollback protection, per-device identity, and protected keys. Espressif documents that [Secure Boot verifies authorized firmware](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/security/secure-boot-v2.html) and recommends combining it with flash encryption for a secure environment.

### Metering

ACS712 is suitable for learning and rough current sensing, not automatic paid billing. Use one of these paths:

- A certified, jurisdiction-appropriate energy meter over isolated Modbus/RS-485 for paid deployments.
- A dedicated metering IC such as the [ADE7953](https://www.analog.com/en/products/ade7953.html) for an open prototype, with a documented isolation, calibration, PCB, and certification plan.

The meter or controller reports integer values (`mV`, `mA`, `W`, `Wh`) plus a monotonic sequence number. The gateway never reconstructs billable energy by adding rounded UI samples.

The current browser lab instead accumulates session-relative integer milli-Wh. Its
[simulator contract boundary](simulator-contract.md) preserves that source and remainder
when projecting whole Wh, and defines the simplified state mapping. These local estimates
are not authoritative meter readings or gateway charges.

### Switching and EV charging

Use a contactor and protection chain rated for the continuous load, installation, fault current, enclosure, and local code. An EVSE adapter additionally needs pilot/proximity handling and the applicable residual-current, grounding, thermal, contactor, and fault logic. Reusing a proven open EVSE controller is the preferred first adapter; designing a new high-voltage EVSE PCB is a separate certification project.

## Protocol decisions

- **App ↔ control plane/gateway:** versioned REST for commands and snapshots; WebSocket or server-sent events for live updates. The draft contract is in [openapi-v2.yaml](openapi-v2.yaml).
- **Control plane ↔ gateway:** OCPP 2.0.1 for an EVSE deployment, behind an internal domain adapter. The Open Charge Alliance lists improved transaction handling, device management, security, and smart charging in [OCPP 2.0.1](https://openchargealliance.org/protocols/open-charge-point-protocol/). Do not expose raw OCPP messages to the app.
- **Gateway ↔ controller:** a small framed, checksummed, versioned protocol over isolated CAN or RS-485. Commands carry an ID, expiry, expected prior state, and bounded grant; responses report actual state.
- **Meter:** Modbus RTU for a certified external meter, or a controller-local driver for a metering IC.

OCPP 2.0.1 is the initial interoperability target because it has certification profiles for core operation, remote control, security, smart charging, and optional ISO 15118 support. OCPP 2.1 can be evaluated after the core session model is stable; OCPP 1.6 and 2.0.1 are not wire-compatible.

## Reference software stack

| Component | Initial choice | Reason |
| --- | --- | --- |
| Controller firmware | Zephyr/C with board-specific drivers; ESP-IDF adapter where needed | Portable MCU support, explicit device model, testable state machine |
| Site gateway | Go, SQLite, and a small adapter interface | Single deployable binary, reliable local persistence, works on Raspberry Pi/Linux |
| Control plane | Go modular monolith and PostgreSQL | Reuses domain types without introducing a distributed system early |
| Live transport | WebSocket/SSE initially; MQTT only at the device/site integration boundary when useful | Avoids making a broker a requirement for a one-port deployment |
| Web/mobile app | React + TypeScript + Vite PWA; optional Capacitor wrapper later | One responsive UI and a modern build path |
| API contract | OpenAPI 3.1 plus generated types | Keeps app, gateway, simulator, and server aligned |
| EV network adapter | OCPP 2.0.1 | Standard transaction, device-management, and smart-charging boundary |
| Payments | Provider adapter; Razorpay and Stripe are example implementations | Keeps regional payment logic out of device/session state |

Start as a modular monolith. Do not add Kafka, Kubernetes, or microservices until real deployment scale requires them.

## Session and payment flow

```text
AVAILABLE
   │ user selects port + tariff
   ▼
AUTHORIZING ── payment/account authorization fails ──► AVAILABLE
   │ verified server-side authorization
   ▼
PREPARING ── controller interlock fails ─────────────► FAULTED
   │ signed, bounded session grant accepted
   ▼
ENERGIZING ── actual contactor feedback missing ─────► FAULTED
   │ actual output confirmed
   ▼
ACTIVE ── user stop / cap / unplug / fault ──────────► STOPPING
   │ final controller meter value recorded
   ▼
COMPLETED ── server reconciliation/capture/refund ───► SETTLED
```

Rules:

1. The server creates an immutable tariff snapshot and a session ID.
2. Payment verification happens server-side. Provider secrets never reach the app, gateway, or controller.
3. A verified authorization produces a signed, expiring grant bounded by port, user/account, maximum energy/time/amount, and session ID.
4. The controller may reject the start for any local reason. “Payment succeeded” never means “power is on.”
5. Meter samples are append-only. The authoritative final charge uses start/end meter values and the stored tariff snapshot.
6. Commands and payment webhooks are idempotent. Duplicate delivery cannot start two sessions or capture twice.
7. Stop and fault handling never wait for a payment or cloud response.

For India, a Razorpay adapter would create an Order on the server, verify the checkout signature, and use signed webhooks as the durable payment signal. Razorpay's official flow says the server is responsible for order creation, signature verification, capture, and webhooks, and that fulfillment must not rely on the browser callback alone: [Standard Checkout](https://razorpay.com/docs/developer-tools/integrations/standard-checkout/). A global Stripe adapter follows the equivalent server-owned intent/webhook model: [Payment Intents](https://docs.stripe.com/payments/payment-intents) and [webhooks](https://docs.stripe.com/webhooks).

Real-money charging remains disabled until the chosen payment flow, refunds/preauthorization behavior, receipts/tax, meter certification, and local resale rules are reviewed for the deployment jurisdiction.

## Tariff and charge model

Store money as integer minor units and energy as integer Wh. Each session snapshots:

- Currency and tax treatment.
- Fixed connection/session fee.
- Energy rate per kWh.
- Optional time rate while active.
- Optional idle rate after charging stops.
- Rounding policy and caps.

The UI can show an estimate during a session, but the server produces the authoritative breakdown from the immutable tariff and final meter values. A corrected meter event creates an adjustment record; it never silently rewrites the original receipt.

## Offline behavior

- The controller always stops locally on a safety fault.
- An in-progress session follows the bounded policy embedded in its signed grant when the network is lost.
- No new paid session starts offline without an unexpired offline authorization explicitly allowed by site policy.
- Gateway events use monotonic per-device sequence numbers and are stored locally until acknowledged upstream.
- Loss of billable meter communication stops a paid session; a non-billing lab adapter may use a separately configured policy.

## Core data model

- `Device`: controller identity, firmware, capabilities, last sequence.
- `Port`: adapter type, availability, requested state, actual state, current limit, faults.
- `Tariff`: versioned pricing rules; immutable once referenced by a session.
- `SessionGrant`: signed authorization and hard limits.
- `Session`: state machine, start/end meter values, stop reason, tariff snapshot.
- `MeterValue`: append-only reading with device sequence and quality flags.
- `Command`: idempotency key, expected prior state, expiry, acknowledgement, actual result.
- `Payment`: provider-neutral state linked to provider IDs; no card data.
- `AuditEvent`: actor, action, timestamp, correlation ID, and result.

## Delivery phases

### Phase 0 — preserve and scope the legacy prototype

- Reproducible ESP8266/UI build and explicit security/safety limitations.
- Fix crash and parser defects without presenting it as deployable paid hardware.

### Phase 1 — contract-first simulator

- OpenAPI contract, domain state machine, tariff engine, and controller simulator.
- PWA screens for ports, live readings, start/stop, session estimate, and faults.
- No mains hardware and no real-money payment.

### Phase 2 — local gateway and low-voltage hardware-in-loop

- Go/SQLite gateway on Linux/Raspberry Pi.
- Isolated controller protocol, signed grants, offline queue, and fault injection.
- Bench contactor feedback and meter simulator before any high-voltage test.

### Phase 3 — metered power adapter

- Certified external meter or reviewed ADE7953 reference board.
- Professionally designed contactor/protection assembly and enclosure.
- Independent safety review and calibration report.

### Phase 4 — EVSE and payment adapters

- Integrate a proven EVSE controller; add OCPP 2.0.1 conformance tests.
- Add payment-provider sandbox adapters and reconciliation.
- Enable real money only after electrical, metrology, tax, privacy, and payment review.

### Phase 5 — productization

- Hardware and firmware threat model, signed release pipeline, manufacturing provisioning, certification, service procedures, and field-update policy.

## Acceptance gates

Do not energize a high-current output until all of these are true:

- The controller fails de-energized under watchdog reset, gateway loss, malformed commands, and meter loss.
- Actual contactor state is independently observed and welded-contact behavior is tested.
- Meter accuracy and calibration are documented for the intended billing claim.
- Protection, enclosure, thermal design, PCB isolation, and installation have been reviewed by qualified engineers.
- App/payment outages cannot prevent a local stop or override a fault.
- Hardware-in-loop tests exercise every state transition and failure path.
