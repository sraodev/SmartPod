# Structured firmware logging

SmartPod's firmware logger provides structured records, severity filtering, component context, and constructor-injected output/clock for tests. It adds no gateway, file collector, remote telemetry, or new dependency.

## Output

By default, application diagnostics are newline-delimited JSON at info level on the existing 115200-baud serial connection:

```json
{"uptime_ms":42,"level":"warn","service":"smartpod","component":"wifi","message":"disconnected","truncated":false,"code":201}
```

Required fields are `uptime_ms`, `level`, `service`, `component`, `message`, and `truncated`. Optional numeric fields are `code` (platform/service error or disconnect reason) and `progress_percent` (OTA progress). Interpret codes together with their component; they are not globally standardized.

`uptime_ms` is unsigned 32-bit device uptime, **not UTC**. It restarts on reboot and wraps after about 49.7 days. This avoids pretending that timestamps are trustworthy before NTP synchronization. These diagnostics are not an audit ledger or a billable meter source.

Components currently cover system startup, storage, settings persistence, HTTP handler failures, Wi-Fi, access-point/captive-portal lifecycle, NTP, OTA, and sensor initialization. OTA progress and NTP scheduling are debug-only; individual sensor readings are not logged. Calibration remains the existing firmware behavior; its warning is not a substitute for an isolated, zero-current bench setup.

## Configuration

Add these build flags under `build_flags` in `platformio.ini`, then rebuild and flash:

```ini
-D SMARTPOD_LOG_LEVEL=0
-D SMARTPOD_LOG_TEXT=1
```

`SMARTPOD_LOG_LEVEL` accepts `0` debug, `1` info (default), `2` warn, `3` error, or `4` off. `SMARTPOD_LOG_TEXT` accepts `0` JSON (default) or `1` text. Invalid configuration fails compilation. There is no runtime REST setting, environment-variable lookup, or flash write for logging.

Example text output:

```text
[42] warn smartpod/wifi: disconnected code=201
```

There is no ANSI color, spinner, or animation. At debug level, OTA progress may be frequent; keep the default info level for normal operation. `off` disables SmartPod application diagnostics, not ROM boot output or third-party library prints.

## Privacy and bounds

- Production call sites use fixed component/message literals and optional numeric fields. Do not pass SSIDs, IP/MAC addresses, hostnames, passwords, JWTs, headers, JSON request bodies, or user-supplied strings into log messages.
- This is a data-minimization policy, **not an automatic secret-redaction guarantee**. The logger cannot recognize a secret embedded in a string literal; review each new call site.
- Component input is capped at 32 bytes and message input at 128 bytes. Oversized input sets `truncated: true`; records remain valid JSON rather than cutting a serialized line mid-string.
- Quotes/backslashes are JSON-escaped. Control and non-ASCII bytes are replaced with `?` so a record cannot inject extra lines or terminal escape sequences. Diagnostic messages are intentionally ASCII-only.
- Formatting uses fixed stack buffers, including a 512-byte output buffer. The core logger performs no heap allocation, file writes, network requests, or explicit flushes. This does not imply Arduino's serial driver is allocation-free or non-blocking.
- Records are handed to the sink in one synchronous write. Calls before `Serial.begin()` are suppressed by the firmware adapter until `beginLogging()` is called. The sink must consume the temporary bytes synchronously, not retain their pointer.
- This implementation targets existing ESP8266 loop/event callbacks. It is not ISR-safe, a multicore synchronization facility, or a guaranteed lossless transport. Do not call it from an interrupt or a safety-critical output loop; capture a status and log later.
- Third-party/ROM diagnostics may still appear on serial. The no-sensitive-values policy and format guarantee apply to SmartPod's migrated application call sites only.

## Implementation and verification

`src/StructuredLogger.h` is the portable C++11 core. `src/FirmwareLog.h` binds it to Arduino Serial and uptime with compile-time defaults. The core's injected sink and clock make tests independent of hardware, wall time, and global configuration; the firmware adapter provides one shared instance for existing services.

```sh
python3 -m unittest discover -s tests -p 'test_logging.py' -v
platformio run -e esp12e
```

The host suite compiles the real logger with warnings treated as errors and validates JSON, text, every severity threshold, instance isolation, escaping, truncation, maximum-size records, clock rollover, null dependencies, pre-serial suppression, configuration validation, and fixed-message call sites. It uses only a tiny serial/clock fake, not a fake firmware build. CI also builds the actual ESP8266 firmware.

Physical serial timing, OTA traffic under load, and bench behavior are not hardware-verified by these tests. Firmware authentication/HTTP limitations and all existing mains-safety restrictions remain unchanged. The [Go gateway](gateway.md) has its own structured lifecycle logs; the [CLI](cli.md) keeps diagnostics on stderr and scriptable JSON on stdout.
