/*********
  This example shows how to measure the power consumption
  of devices in 230V electrical system
  or any other system with alternative current
*********/

// Import required libraries
#include <Arduino.h>
#include <SmartPod.h>

SmartPod smartpod = SmartPod();

void setup()
{
  smartpod.begin();
}

void loop()
{
  smartpod.loop();
}
