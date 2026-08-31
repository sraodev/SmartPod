## Unqualified firmware preview

This release contains ESP8266 firmware and its device filesystem, not a SmartPod CLI.
It is for isolated laboratory evaluation only. It does not establish certified EVSE
behavior, safe mains control, revenue-grade metering, or real-money billing.

Known limitations remain: legacy HTTP, public demo credentials/secrets, non-expiring
tokens, and no physical flash/OTA or hardware qualification from CI. Do not deploy
on a production network or energize mains based on a successful build.

Verify the manifest's exact source commit, artifact sizes, SHA-256 hashes, and GitHub
build attestations before use. SBOMs are dependency inventories with documented gaps,
not security approval. Rebuilding successfully is not proof of byte-identical output.
See `docs/releases.md` at the release tag for rebuild and independent verification
commands. No release asset is replaced by this workflow.
