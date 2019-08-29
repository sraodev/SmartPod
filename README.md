# Smart Pod

Smart Pod addresses the entire process of charging electric vehicles (EV).

Designed to work with the PlatformIO IDE with [limited setup](#getting-started). Please read below for setup, build and upload instructions.

## Features

Provides many of the features required for IoT projects:

* Configurable WiFi - Network scanner and WiFi configuration screen
* Configurable Access Point - Can be continuous or automatically enabled when WiFi connection fails
* Network Time - Synchronization with NTP
* Remote Firmware Updates - Enable secured OTA updates
* Security - Protected RESTful endpoints and a secured user interface

The back end is provided by a set of RESTful endpoints and the React based front end is responsive and scales well to various screen sizes.

The front end has the prerequisite manifest file and icon, so it can be added to the home screen of a mobile device if required.

## Getting Started

### Prerequisites

You will need the following before you can get started.

* [PlatformIO](https://platformio.org/) - IDE for development
* [Node.js](https://nodejs.org) - For building the interface with npm
* Bash shell, or [Git Bash](https://gitforwindows.org/) if you are under windows


## Libraries Used

* [React](https://reactjs.org/)
* [Material-UI](https://material-ui-next.com/)
* [Time](https://github.com/PaulStoffregen/Time)
* [NtpClient](https://github.com/gmag11/NtpClient)
* [ArduinoJson](https://github.com/bblanchon/ArduinoJson)
* [ESPAsyncWebServer](https://github.com/me-no-dev/ESPAsyncWebServer)