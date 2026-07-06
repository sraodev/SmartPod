<div align="center">

<img src="/media/smartpod.png?raw=true" width="120" alt="SmartPod logo" />

# SmartPod

### An open-source, IoT-enabled smart charging pod for electric vehicles

Meter every charge in real time — voltage, current, power, energy and cost — from a phone-friendly dashboard running on a &#8377;300 microcontroller.

[![Platform](https://img.shields.io/badge/platform-ESP8266%20%7C%20ESP32-blue.svg)](https://platformio.org/)
[![Framework](https://img.shields.io/badge/framework-Arduino-00979D.svg)](https://www.arduino.cc/)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Material--UI-61DAFB.svg)](https://reactjs.org/)
[![License: LGPL v3](https://img.shields.io/badge/license-LGPL%20v3-green.svg)](LICENSE.txt)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

![Screenshots](/media/screenshots.png?raw=true "SmartPod interface")

</div>

## What is SmartPod?

**SmartPod** turns an inexpensive ESP8266/ESP32 board and a Hall-effect current
sensor into a connected EV charging point. It measures the electricity flowing
to your vehicle and reports **live voltage, current, power, energy consumed and
the running bill** to a secure, responsive web dashboard — no cloud account and
no subscription required.

It is built on a hardened IoT foundation (secured REST API, WiFi provisioning,
over-the-air updates and NTP time-sync), so the charging intelligence sits on
top of production-grade device plumbing rather than a weekend prototype.

> ⚡ **Why it matters:** home and workplace EV charging is growing fast, but most
> people have no idea what a single charge actually costs. SmartPod gives you
> that visibility on hardware that costs less than a cup of coffee per unit.

## Highlights

- 🔌 **Real-time energy metering** — voltage, current and power sampled live from an ACS712 current sensor
- 📊 **Energy & cost tracking** — running energy usage (kWh), configurable tariff and an itemised bill
- 📱 **Installable dashboard** — responsive React + Material-UI UI that scales from phone to desktop and can be added to your home screen as a PWA
- 🔐 **Secure by design** — JWT-protected REST endpoints and a login-gated interface
- 🛰️ **Wireless everything** — WiFi provisioning with an access-point fallback, NTP time sync and OTA firmware updates
- 💾 **Fits on-device** — the whole gzipped UI is ~200 kB and lives in flash alongside the firmware
- 🧩 **Board-agnostic** — the same codebase targets ESP8266 and ESP32

## Live metrics

The dashboard surfaces the following readings, refreshed on demand from the device:

| Metric | Unit | Description |
| ------------- | ------ | ---------------------------------------------- |
| Voltage       | V      | Supply voltage (defaults to 230 V / 50 Hz)     |
| Current       | A      | AC current drawn by the vehicle                |
| Power         | W      | Instantaneous power (V × I)                     |
| Energy usage  | kWh    | Energy delivered over the charging session      |
| Energy tariff | INR    | Price per kWh                                    |
| Energy bill   | INR    | Running cost of the session                      |

## How it works

```
        ┌──────────────┐      AC current      ┌──────────────┐
  Grid ─┤ ACS712 Sensor ├─────── measures ─────┤  EV / Vehicle │
        └──────┬───────┘                       └──────────────┘
               │ analog signal (A0)
        ┌──────┴───────────────┐   REST/JSON over WiFi   ┌──────────────┐
        │  ESP8266 / ESP32     ├─────────────────────────┤  React PWA    │
        │  • SmartPodService   │      (JWT secured)       │  dashboard    │
        │  • Async web server  │                          └──────────────┘
        │  • SPIFFS config     │
        └──────────────────────┘
```

The firmware reads the current sensor through the Adafruit Unified Sensor
interface, derives power and energy figures in `SmartPodService`, and exposes
them at `/rest/smartpodStatus`. The React front end polls that endpoint and
renders the live dashboard. Every configurable feature persists its settings as
JSON in SPIFFS, so your device keeps its configuration across reboots.

## Hardware

You can build a bench prototype with just three things:

| Component | Notes |
| -------------------------------------- | -------------------------------------------------------------- |
| ESP8266 (e.g. ESP-12E) **or** ESP32    | ≥ 2 MB flash recommended so OTA updates have room to work       |
| ACS712 current sensor (05B / 20A / 30A)| Hall-effect AC current sensor; sensor type is configurable      |
| 5 V power supply / USB                 | Powers the microcontroller                                      |

The ACS712 output connects to the board's analog pin (`A0` by default). Pick the
sensor variant that matches your expected charging current — `ACS712_30A` is the
default and suits most single-phase home charging.

> ⚠️ **Safety first:** SmartPod measures mains AC. Wiring current sensors into
> mains voltage is dangerous and should only be done by someone competent to
> work with mains electricity, ideally behind proper isolation and protection.

<div align="center">
<img src="/media/esp12e.jpg?raw=true" width="45%" alt="ESP-12E" />
&nbsp;&nbsp;
<img src="/media/esp32.jpg?raw=true" width="45%" alt="ESP32" />
</div>

## Getting started

### Prerequisites

- [PlatformIO](https://platformio.org/) — IDE / build system for the firmware
- [Node.js](https://nodejs.org) — to build the React interface with npm
- A Bash shell — [Git Bash](https://gitforwindows.org/) works on Windows

### Project layout

| Resource                         | Description                            |
| -------------------------------- | -------------------------------------- |
| [data/](data)                    | SPIFFS file-system image (UI + config) |
| [interface/](interface)          | React based front end                  |
| [src/](src)                      | C++ firmware for the ESP device        |
| [platformio.ini](platformio.ini) | PlatformIO project configuration       |

### 1. Build & upload the firmware

Open the project in PlatformIO — it downloads the platform and library
dependencies automatically — then build and flash:

```bash
platformio run              # build
platformio run -t upload    # flash over serial (default)
```

Uploads run over serial by default; uncomment the OTA lines in
[`platformio.ini`](platformio.ini) to flash wirelessly instead.

### 2. Build & upload the interface

The interface is a create-react-app project tuned for the device: large assets
are gzipped and source maps / service workers are excluded, keeping the
production build to ~200 kB.

```bash
cd interface
npm install
npm run build               # also copies the build into data/www
```

Then flash the file-system image:

```bash
platformio run -t uploadfs
```

### 3. (Optional) Run the interface locally

Preview UI changes without re-flashing after every edit:

```bash
cd interface
npm start
```

To talk to a real device from the dev server, point
`REACT_APP_ENDPOINT_ROOT` in [`interface/.env.development`](interface/.env.development)
at your device and enable CORS by uncommenting the `-D ENABLE_CORS` build flag in
[`platformio.ini`](platformio.ini):

```
-D ENABLE_CORS
-D CORS_ORIGIN=\"http://localhost:3000\"
```

## Configuration & defaults

On first boot the device starts an access point you can connect to for setup:

| Setting  | Default        |
| -------- | -------------- |
| AP SSID  | `ESP8266-React`|
| AP Pass  | `esp-react`    |

The interface ships with two demo accounts — **change these before deploying**:

| Username | Password |
| -------- | -------- |
| admin    | admin    |
| guest    | guest    |

Each feature stores its settings as JSON under [`data/config`](data/config)
(access point, NTP, OTA, security, WiFi and the SmartPod sensor). The SmartPod
sensor itself is configured in [`spSettings.json`](data/config/spSettings.json):

```json
{
  "sensor_type": "ACS712_30A",
  "sensor_pin": "A0",
  "voltage": 230,
  "frequency": 50.0,
  "energy_traiff": 0.0
}
```

## Targeting a different board

By default the project targets the `esp12e` (ESP8266, 4 MB flash). Building for an
ESP32 is a one-line change in [`platformio.ini`](platformio.ini):

```ini
[env:node32s]
platform = espressif32
board = node32s
```

## Customizing the app

- **Theme** — edit the Material-UI theme in [`interface/src/App.js`](interface/src/App.js)
- **Name** — set `REACT_APP_NAME` in [`interface/.env`](interface/.env)
- **Icon** — replace `interface/public/app/icon.png` (256 × 256 PNG recommended)

## Extending the backend

The firmware is organised by feature. Adding a new configurable service means
extending the abstract [`SettingsService`](src/SettingsService.h) and
implementing the JSON (de)serialization — persistence to SPIFFS is handled for
you:

```cpp
class ExampleSettingsService : public SettingsService {
public:
  ExampleSettingsService(AsyncWebServer* server, FS* fs)
    : SettingsService(server, fs, "/exampleSettings", "/config/exampleSettings.json") {}

protected:
  void readFromJsonObject(JsonObject& root) {
    _username = root["username"] | "";
    _password = root["password"] | "";
  }
  void writeToJsonObject(JsonObject& root) {
    root["username"] = _username;
    root["password"] = _password;
  }

private:
  String _username;
  String _password;
};
```

Construct it, then `begin()` — a GET/POST REST endpoint appears at your chosen
path and settings persist automatically. Override `onConfigUpdated()` to react
to changes at runtime.

## Roadmap

SmartPod is actively evolving. Planned and in-progress work:

- [ ] Cumulative **energy usage** integration (Wh over time)
- [ ] **Tariff** loaded from configuration and applied live
- [ ] Automatic **energy bill** calculation
- [ ] Historical charts and session history
- [ ] Configurable currency (beyond INR)

Contributions toward any of these are very welcome — see below.

## Contributing

Contributions, issues and feature requests are welcome! If SmartPod is useful to
you, please consider **giving it a ⭐** — it genuinely helps.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-thing`)
3. Commit your changes with a clear message
4. Push the branch and open a pull request

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Built with

- [React](https://reactjs.org/) & [Material-UI](https://material-ui.com/)
- [ESPAsyncWebServer](https://github.com/me-no-dev/ESPAsyncWebServer)
- [ArduinoJson](https://github.com/bblanchon/ArduinoJson)
- [ACS712](https://github.com/RobTillaart/ACS712) current-sensor library
- [Time](https://github.com/PaulStoffregen/Time) & [NtpClient](https://github.com/gmag11/NtpClient)

The IoT foundation is inspired by the excellent
[esp8266-react](https://github.com/rjwats/esp8266-react) framework.

## License

Distributed under the **GNU LGPL v3** license. See [LICENSE.txt](LICENSE.txt) for
more information.

---

<div align="center">
If SmartPod helped you meter your charging, consider starring the repo ⭐
</div>
