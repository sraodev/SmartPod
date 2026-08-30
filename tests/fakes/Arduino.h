#ifndef SMARTPOD_TEST_ARDUINO_H
#define SMARTPOD_TEST_ARDUINO_H

#include <stddef.h>
#include <stdint.h>

// Only the logger's serial/clock adapter is faked, not the firmware services.
class HardwareSerial {
public:
  size_t write(const uint8_t* data, size_t size);
};

extern HardwareSerial Serial;
unsigned long millis();

#endif
