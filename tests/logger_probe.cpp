#include <FirmwareLog.h>

#include <cassert>
#include <iostream>
#include <string>

using namespace smartpod_logging;

static unsigned int sinkCalls = 0;
static unsigned int clockCalls = 0;
static uint32_t clockValue = 42;

static void sink(const char* bytes, size_t length) {
  ++sinkCalls;
  assert(length < 512);
  assert(bytes[length - 1] == '\n');
  std::cout.write(bytes, length);
}

static uint32_t clockNow() {
  ++clockCalls;
  return clockValue;
}

HardwareSerial Serial;
size_t HardwareSerial::write(const uint8_t* bytes, size_t length) {
  sink(reinterpret_cast<const char*>(bytes), length);
  return length;
}
unsigned long millis() { return clockNow(); }

int main(int argc, char** argv) {
  assert(argc == 2);
  const std::string mode(argv[1]);
  StructuredLogger log(sink, clockNow, LogLevel::Debug);

  if (mode == "json") {
    log.write(LogLevel::Warn, "wifi", "disconnected", LogField::Code, 201);
  } else if (mode == "text") {
    StructuredLogger text(sink, clockNow, LogLevel::Info, LogFormat::Text);
    text.write(LogLevel::Info, "ota", "progress", LogField::ProgressPercent, 50);
  } else if (mode == "levels") {
    const char* names[] = {"debug", "info", "warn", "error", "off"};
    for (int minimum = 0; minimum <= 4; ++minimum) {
      StructuredLogger filtered(sink, clockNow, static_cast<LogLevel>(minimum));
      for (int level = 0; level <= 4; ++level) {
        filtered.write(static_cast<LogLevel>(level), names[minimum], "event");
      }
    }
  } else if (mode == "filtered") {
    StructuredLogger quiet(sink, clockNow, LogLevel::Error);
    quiet.write(LogLevel::Info, "wifi", "hidden");
    assert(sinkCalls == 0 && clockCalls == 0);
  } else if (mode == "independent") {
    StructuredLogger quiet(sink, clockNow, LogLevel::Error, LogFormat::Text);
    quiet.write(LogLevel::Info, "wifi", "hidden");
    log.write(LogLevel::Info, "wifi", "visible");
    assert(sinkCalls == 1);
  } else if (mode == "escaping") {
    log.write(LogLevel::Info, "http\n\"", "quotes \" slashes \\ controls\n\r\t\x1b[31m percent %s");
  } else if (mode == "text-controls") {
    StructuredLogger text(sink, clockNow, LogLevel::Info, LogFormat::Text);
    text.write(LogLevel::Info, "wifi\n", "line\r\n\x1b[2J");
  } else if (mode == "maximum") {
    clockValue = UINT32_MAX;
    log.write(LogLevel::Error, std::string(32, '"').c_str(), std::string(128, '\\').c_str(),
              LogField::Code, UINT32_MAX);
  } else if (mode == "truncation") {
    log.write(LogLevel::Info, std::string(33, 'c').c_str(), std::string(129, 'm').c_str());
  } else if (mode == "nulls") {
    StructuredLogger noClock(sink, nullptr);
    noClock.write(LogLevel::Info, nullptr, nullptr);
    StructuredLogger noSink(nullptr, clockNow);
    noSink.write(LogLevel::Error, "system", "discarded");
    assert(sinkCalls == 1 && clockCalls == 0);
  } else if (mode == "wrap") {
    clockValue = UINT32_MAX;
    log.write(LogLevel::Info, "system", "before wrap");
    clockValue = 0;
    log.write(LogLevel::Info, "system", "after wrap");
  } else if (mode == "startup") {
    logger().write(LogLevel::Info, "system", "before serial setup");
    assert(sinkCalls == 0);
    beginLogging();
    logger().write(LogLevel::Info, "system", "after serial setup");
    assert(sinkCalls == 1);
  } else {
    return 2;
  }
  return 0;
}
