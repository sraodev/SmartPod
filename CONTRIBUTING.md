# Contributing to SmartPod

Thanks for helping improve SmartPod. The project is especially looking for contributors who can test on real ESP hardware and make the monitoring path safer, more accurate, and easier to reproduce.

## Good first contributions

- Reproduce a build and document the exact board and tool versions.
- Improve calibration or compare readings with a trusted reference meter.
- Add focused tests for pure calculation or validation code.
- Validate the v2 API contract or help build the hardware-free controller simulator.
- Clarify setup, safety, and troubleshooting documentation.
- Tackle one item from [ROADMAP.md](ROADMAP.md).

Please open an issue before starting a large dependency migration, hardware redesign, or API change. That keeps effort aligned and avoids parallel rewrites.

## Development setup

SmartPod has these build targets:

- Firmware in `src/`, built with PlatformIO.
- Dashboard in `interface/`, built with npm.
- Read-only gateway and CLI in `gateway/`, built with Go; see the [hardware-free CLI quickstart](docs/cli.md).

Follow the [README quick start](README.md#quick-start) first. The GitHub Actions workflow records the supported CI tool versions.

## Making a change

1. Fork the repository and branch from `master`.
2. Keep the change focused on one behavior or documentation concern.
3. Reuse existing patterns before adding dependencies or abstractions.
4. Add or update the smallest relevant test.
5. Run the checks that apply to your change.

```bash
# Dashboard
cd interface
npm ci
npm test -- --watchAll=false
npm run build
npm run build:demo

# Firmware
cd ..
platformio run

# Hardware-free gateway and CLI
cd gateway
go test -race ./...
go vet ./...
go build -o build/smartpod ./cmd/smartpod
cd ..
node scripts/test-gateway-contract.cjs
```

If hardware is required, include the board, sensor variant, wiring conditions, and reference equipment in your test notes. Never include Wi-Fi passwords, tokens, private IPs, or other secrets in logs or screenshots.

## Pull requests

A useful pull request explains:

- What user-visible behavior changed and why.
- Which commands were run and their results.
- Which board/sensor was tested, or why hardware testing was not possible.
- Any safety, compatibility, flash-size, or migration impact.

Screenshots are welcome for UI changes. Keep generated build output out of the commit.

## Reporting bugs and security issues

Use the bug form for ordinary defects. Please follow [SECURITY.md](SECURITY.md) instead of opening a public issue for vulnerabilities or exposed credentials.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
