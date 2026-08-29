# SmartPod roadmap

This roadmap starts with a safe simulator and earns its way toward controlled power. The detailed boundaries and acceptance gates are in [docs/architecture-v2.md](docs/architecture-v2.md).

## 0. Stabilize the legacy prototype

- [x] Restore reproducible ESP8266, dashboard, and filesystem builds.
- [x] Add CI, smoke tests, contribution templates, and honest safety/security documentation.
- [x] Fix the unbounded JSON parse and uninitialized service pointers found during review.
- [ ] Replace public default credentials and secrets with first-boot provisioning.
- [ ] Add token expiry, revocation, and a maintained embedded networking stack.
- [ ] Replace the deprecated Create React App/Material UI v4 build stack with the v2 Vite PWA.

## 1. Contract-first simulator

- [x] Publish the first draft of the port/session OpenAPI contract.
- [x] Implement a deterministic port and session state machine in the browser simulator.
- [x] Implement immutable tariff snapshots using integer money and milli-Wh accumulation.
- [x] Add a browser simulator for readings, contactor feedback, disconnects, and faults.
- [ ] Build the PWA screens for ports, live values, start/stop, estimates, and faults.
- [ ] Test the entire flow without mains hardware or real payments.
- [ ] Publish a hosted simulator demo and a short reproducible walkthrough.

## 2. Local gateway and controller protocol

- [ ] Build the Go/SQLite gateway for Raspberry Pi and other Linux targets.
- [ ] Define the framed, checksummed, versioned MCU protocol over isolated CAN or RS-485.
- [ ] Add signed, expiring session grants and idempotent commands.
- [ ] Persist an offline event ledger with monotonic device sequence numbers.
- [ ] Add hardware-in-loop fault injection and prove local stop behavior.

## 3. Metered smart-power adapter

- [ ] Integrate a jurisdiction-appropriate external meter over isolated Modbus/RS-485.
- [ ] Design and review the contactor, feedback, protection, enclosure, and thermal chain for one declared load class.
- [ ] Document calibration, accuracy, threat model, failure analysis, and installation limits.
- [ ] Complete independent electrical and safety review before energizing a high-current output.

## 4. EVSE and payment adapters

- [ ] Integrate a proven EVSE controller with pilot, protection, contactor, and local-fault handling.
- [ ] Add an OCPP 2.0.1 adapter and conformance tests.
- [ ] Add sandboxed, server-side payment-provider adapters and webhook reconciliation.
- [ ] Add receipts, refunds, tax handling, and versioned tariff breakdowns.
- [ ] Enable real money only after electrical, metrology, privacy, tax, and payment review for the target market.

## 5. Productization

- [ ] Publish open KiCad files, BOM, assembly notes, safety-state diagram, and reproducible test records.
- [ ] Add per-device identity, signed updates, rollback protection, and manufacturing provisioning.
- [ ] Complete the applicable product and installation certification.
- [ ] Publish signed releases with firmware, gateway, app, SBOM, and qualification notes.
- [ ] Add Home Assistant discovery after the telemetry contract is stable.

## Deferred

- A custom OCPP implementation when a maintained open stack can be adapted.
- A custom revenue meter.
- Direct handling of payment-card data.
- ISO 15118, Plug & Charge, bidirectional charging, and DC fast charging.
