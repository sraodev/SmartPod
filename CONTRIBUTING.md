# Contributing to SmartPod

First off — thank you for taking the time to contribute! 🎉 SmartPod is an
open-source EV charging project, and every issue, idea and pull request helps.

## Ways to contribute

- ⭐ **Star the repo** — the simplest way to show support and help others find it
- 🐛 **Report bugs** — open an issue with clear steps to reproduce
- 💡 **Suggest features** — see the [roadmap](README.md#roadmap) for ideas already on our radar
- 📖 **Improve docs** — typos, clarifications and better wiring diagrams are all welcome
- 🔌 **Write code** — pick up a roadmap item or fix an open issue

## Development setup

SmartPod has two halves — firmware and interface. See the
[Getting started](README.md#getting-started) section of the README for the full
build and flash instructions.

- **Firmware** (`src/`) — C++ built with [PlatformIO](https://platformio.org/)
- **Interface** (`interface/`) — React + Material-UI, built with npm

You can run the interface locally against a real device (`npm start`) without
re-flashing after every change.

## Pull request guidelines

1. Fork the repository and create your branch from `master`
2. Keep changes focused — one logical change per pull request
3. Match the existing code style (both C++ and JS)
4. Test on real hardware where you can, and say which board you used
5. Write a clear PR description explaining **what** changed and **why**

## Reporting bugs

A good bug report includes:

- Board and sensor you're using (e.g. ESP-12E + ACS712_30A)
- What you expected to happen vs. what actually happened
- Steps to reproduce, and any serial-monitor output

## Code of conduct

Be kind and constructive. We want SmartPod to be a welcoming project for
makers of all experience levels.

Thanks again for helping make SmartPod better! ⚡
