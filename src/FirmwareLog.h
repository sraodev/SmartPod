#ifndef SMARTPOD_FIRMWARE_LOG_H
#define SMARTPOD_FIRMWARE_LOG_H

#include <Arduino.h>
#include <StructuredLogger.h>

#ifndef SMARTPOD_LOG_LEVEL
#define SMARTPOD_LOG_LEVEL 1
#endif
#ifndef SMARTPOD_LOG_TEXT
#define SMARTPOD_LOG_TEXT 0
#endif
static_assert(SMARTPOD_LOG_LEVEL >= 0 && SMARTPOD_LOG_LEVEL <= 4,
              "SMARTPOD_LOG_LEVEL must be 0 (debug) through 4 (off)");
static_assert(SMARTPOD_LOG_TEXT == 0 || SMARTPOD_LOG_TEXT == 1,
              "SMARTPOD_LOG_TEXT must be 0 (JSON) or 1 (text)");

namespace smartpod_logging {

inline bool& serialLoggingReady() {
  static bool ready = false;
  return ready;
}

inline void beginLogging() {
  serialLoggingReady() = true;
}

inline void serialLogSink(const char* record, size_t length) {
  // Some legacy service constructors run before Serial.begin().
  if (serialLoggingReady()) {
    Serial.write(reinterpret_cast<const uint8_t*>(record), length);
  }
}

inline uint32_t logUptime() { return static_cast<uint32_t>(millis()); }

inline const StructuredLogger& logger() {
  static const StructuredLogger instance(serialLogSink, logUptime,
    static_cast<LogLevel>(SMARTPOD_LOG_LEVEL), SMARTPOD_LOG_TEXT ? LogFormat::Text : LogFormat::Json);
  return instance;
}

} // namespace smartpod_logging

#endif
