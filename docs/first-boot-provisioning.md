# First-boot provisioning

The legacy ESP8266 image no longer contains shared administrator, JWT, Wi-Fi,
access-point, or OTA passwords. A new or unchanged legacy-public installation
starts unprovisioned and normal administration remains unavailable until one
local provisioning request succeeds.

This is a legacy-device security baseline, not approval for an untrusted
network, mains control, paid billing, or production deployment.

## First boot

1. Flash the firmware and filesystem image.
2. Stay physically near the device and join the temporary open network named
   `SmartPod-Setup-<chip-id>`. Do not perform provisioning in a public place.
3. Send one JSON request to `http://192.168.4.1/rest/provision` containing a
   `username` and `password`. Usernames accept 1-24 letters, digits, `_`, or
   `.`; passwords accept 8-64 characters.
4. A successful request returns HTTP 204. The endpoint then returns HTTP 409,
   the setup network stops, and normal sign-in becomes available with the new
   administrator credentials.
5. Sign in and configure station Wi-Fi. Enable an ongoing access point or OTA
   only after setting a new password for that service.

The firmware obtains 32 bytes from the ESP hardware random generator and
stores the resulting 64-character JWT signing secret. The value is never sent
by a settings response and is never written to logs.

## Reset and recovery

An authenticated administrator can POST to
`/rest/securitySettings/reset`. A successful reset returns HTTP 204, rotates
the signing secret, removes all users, invalidates existing bearer tokens, and
re-enters one-time provisioning mode.

If administrator access is lost, erase and re-upload the repository filesystem
image over the device's physical serial connection:

```sh
platformio run --target erase
platformio run --target upload
platformio run --target uploadfs
```

That recovery destroys device configuration and sessions. It requires physical
access and must be followed by first-boot provisioning.

## Upgrade behavior

- An unchanged public legacy image using the known `esp8266-react` signing
  secret is treated as unprovisioned. Its public users are removed and its
  signing secret is replaced on boot.
- A legacy installation with a non-default signing secret and an administrator
  is preserved and receives the new `provisioned` marker when settings are next
  saved.
- Missing, malformed, or partially written security settings fail closed into
  provisioning mode. Normal authentication stays disabled.

## Secret response contract

Ordinary settings responses retain the fields expected by the legacy UI but
return empty values for JWT, user, Wi-Fi, access-point, and OTA passwords. A
corresponding `*_set` boolean tells the UI whether leaving the field blank will
preserve an existing value. Posting security/user changes rotates the JWT
secret and therefore invalidates existing tokens.

## Verification status

| Check | Status | Evidence |
| --- | --- | --- |
| First-boot, legacy-upgrade, customized-upgrade, one-time, validation, and interrupted-persistence policy | Software-tested | `tests/test_provisioning.py` compiles and runs the production policy |
| Secret and password redaction contract | Software-tested | Focused source regression checks and ESP8266 build |
| Firmware and SPIFFS compatibility | Software-tested | Pinned PlatformIO firmware and `buildfs` targets |
| AP visibility, disconnect timing, power-loss interruption, and serial recovery | Planned | Requires a physical ESP8266 board; blank evidence is not a pass |
