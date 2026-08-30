#ifndef SMARTPOD_STRUCTURED_LOGGER_H
#define SMARTPOD_STRUCTURED_LOGGER_H

#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

namespace smartpod_logging {

enum class LogLevel { Debug, Info, Warn, Error, Off };
enum class LogFormat { Json, Text };
enum class LogField { None, Code, ProgressPercent };

// No heap, files, network, or global configuration. The sink consumes bytes
// synchronously; the clock reports uptime rather than an untrusted wall clock.
class StructuredLogger {
public:
  typedef void (*Sink)(const char*, size_t);
  typedef uint32_t (*Clock)();

  StructuredLogger(Sink sink, Clock clock, LogLevel level = LogLevel::Info,
                   LogFormat format = LogFormat::Json)
    : _sink(sink), _clock(clock), _level(level), _format(format) {}

  void write(LogLevel level, const char* component, const char* message,
             LogField field = LogField::None, uint32_t value = 0) const {
    if (!_sink || level < _level || level >= LogLevel::Off) {
      return;
    }

    char safeComponent[65];
    char safeMessage[257];
    bool truncated = encode(component, safeComponent, 32);
    truncated = encode(message, safeMessage, 128) || truncated;
    const char* fieldName = field == LogField::Code ? "code" :
                            field == LogField::ProgressPercent ? "progress_percent" : nullptr;
    char extra[48] = "";
    if (fieldName) {
      snprintf(extra, sizeof(extra), _format == LogFormat::Json ? ",\"%s\":%lu" : " %s=%lu",
               fieldName, static_cast<unsigned long>(value));
    }

    char record[512];
    const unsigned long uptime = _clock ? static_cast<unsigned long>(_clock()) : 0;
    int length;
    if (_format == LogFormat::Json) {
      length = snprintf(record, sizeof(record),
        "{\"uptime_ms\":%lu,\"level\":\"%s\",\"service\":\"smartpod\",\"component\":\"%s\","
        "\"message\":\"%s\",\"truncated\":%s%s}\n",
        uptime, levelName(level), safeComponent, safeMessage, truncated ? "true" : "false", extra);
    } else {
      length = snprintf(record, sizeof(record), "[%lu] %s smartpod/%s: %s%s%s\n",
        uptime, levelName(level), safeComponent, safeMessage, extra, truncated ? " [truncated]" : "");
    }
    // Never emit a partial JSON record, even if a future schema change exceeds the bound.
    if (length > 0 && static_cast<size_t>(length) < sizeof(record)) {
      _sink(record, static_cast<size_t>(length));
    }
  }

private:
  Sink _sink;
  Clock _clock;
  LogLevel _level;
  LogFormat _format;

  static const char* levelName(LogLevel level) {
    switch (level) {
      case LogLevel::Debug: return "debug";
      case LogLevel::Info: return "info";
      case LogLevel::Warn: return "warn";
      case LogLevel::Error: return "error";
      default: return "off";
    }
  }

  bool encode(const char* input, char* output, size_t limit) const {
    if (!input) {
      *output = '\0';
      return false;
    }
    size_t index = 0;
    for (; index < limit && input[index]; ++index) {
      unsigned char c = static_cast<unsigned char>(input[index]);
      // Diagnostics are ASCII-only. Remove terminal control bytes and line breaks.
      if (c < 32 || c > 126) {
        c = '?';
      }
      if (_format == LogFormat::Json && (c == '"' || c == '\\')) {
        *output++ = '\\';
      }
      *output++ = static_cast<char>(c);
    }
    *output = '\0';
    return index == limit && input[index] != '\0';
  }
};

} // namespace smartpod_logging

#endif
