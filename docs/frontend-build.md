# Frontend build targets

SmartPod uses Vite for the device dashboard and hardware-free hosted simulator,
and Vitest for the existing behavior tests. The migration deliberately keeps
the React 16 and Material UI v4 application code unchanged so build-system
changes do not become a visual redesign.

## Commands

Run these commands from `interface/`:

```sh
npm ci
npm test
npm run build
PUBLIC_URL=/SmartPod REACT_APP_DEMO_MODE=true npm run build:demo
```

`npm run build` creates the device target and copies it to `data/www`. Its
JavaScript filenames remain short, and JavaScript is stored only as `.js.gz`
because the legacy ESPAsyncWebServer serves the pre-compressed response for a
`.js` request. The CI build also runs `pio run -e esp12e -t buildfs`, which is
the authoritative check that the generated files fit the configured SPIFFS
image.

`npm run build:demo` creates an ordinary, uncompressed hosted build in
`interface/build`. `PUBLIC_URL` retains the existing GitHub Pages base path and
`REACT_APP_DEMO_MODE` retains the public simulator route behavior. The
`REACT_APP_NAME` and `REACT_APP_ENDPOINT_ROOT` variables keep their existing
meaning for device and local-development builds.

The checked-in web app manifest is retained for metadata and installability.
This migration does not add a service worker or offline caching: session
offline behavior belongs to the explicit simulator policy in issue #17, and a
cache must not imply that network, payment, or device state is current.

## Staged migration checklist

- [x] Replace Create React App, react-app-rewired, and webpack compression with
  Vite and a repository-owned device compression step.
- [x] Move existing Jest behavior tests to Vitest without changing their
  assertions.
- [x] Preserve device routes, simulator mode, environment variables, public
  assets, disclosure text, and the `data/www` packaging contract.
- [x] Verify clean install, tests, device build, hosted build, compressed
  JavaScript, and filesystem-image construction in CI.
- [x] Remove the retired build dependencies and record the resulting npm audit.
- [ ] Migrate React and Material UI in a separate behavior-preserving stage;
  that work affects shared UI, forms, snackbars, and accessibility coverage.
- [ ] Add service-worker behavior only with an explicit cache/update design and
  regression tests for safety and billing disclosures.

At the migration baseline, `data/www` is 264 KiB and the hosted build is 676
KiB on macOS. These measurements are diagnostic rather than cross-platform
byte limits; successful `buildfs` construction is the enforced device-size
gate.
