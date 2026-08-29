# Security policy

## Project status

SmartPod is an experimental local-network hardware project. The current firmware serves HTTP, ships public demo credentials in the filesystem image, stores configuration secrets as plaintext JSON, and issues bearer tokens without expiry. Do not expose a device to the public internet or an untrusted network.

Only the latest commit on `master` is considered for security fixes. No released version is currently supported.

## Reporting a vulnerability

Please do not open a public issue for vulnerabilities, credentials, or exploit details.

Report the issue privately through GitHub's **Security** tab using **Report a vulnerability**. If private vulnerability reporting is unavailable, contact the repository owner through the email listed on the [maintainer's GitHub profile](https://github.com/sraodev).

Include the affected commit, device/board, reproduction steps, impact, and any suggested mitigation. Please allow reasonable time for acknowledgement and remediation before public disclosure.

## Deployment guidance

- Replace every checked-in password, user, and JWT secret before flashing.
- Keep the device on an isolated, trusted LAN with no inbound internet exposure.
- Treat browser tokens and configuration backups as secrets.
- Verify firmware sources and build outputs before enabling OTA updates.
- Do not rely on SmartPod for electrical protection, charger control, or billing.
