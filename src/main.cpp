/*********
  This example shows how to measure the power consumption
  of devices in 230V electrical system
  or any other system with alternative current
*********/

// Import required libraries
#include <Arduino.h>

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESPAsyncTCP.h>
  #include <ESPAsyncWebServer.h>
#elif defined(ESP_PLATFORM)
  #include <WiFi.h>
  #include <AsyncTCP.h>
  #include <SPIFFS.h>
#endif

#include <FS.h>

#define SERIAL_BAUD_RATE 115200

// Create AsyncWebServer object on port 80
AsyncWebServer server(80);

// Replace with your network credentials
const char *ssid = "SriFi";
const char *password = "flying_cheetah_with_a_jetpack_421";



float voltage = 230.0;
float current = 0.0;
float power = 0.0;
float energy = 0.0;
float energyTraiff = 0.0;
float energyBill = 0.0;

float getRand(int range)
{
  float r = ((float)rand() / RAND_MAX) * range;
  return r;
}

float getVoltage()
{
  return voltage;
}

float getCurrent()
{
  //current = sensor.getCurrentAC();
  return current;
}

float getPower()
{
  power = voltage * current;
  return power;
}

float getEnergy()
{
  return energy;
}

float getEnergyTraiff()
{
  return energyTraiff;
}

float getEnergyBill()
{
  return energyBill;
}

void setup()
{
  // TODO: make it false
  // Disable wifi config persistance and auto reconnect
  WiFi.persistent(true);
  WiFi.setAutoReconnect(true);

#if defined(ESP_PLATFORM)
  // Init the wifi driver on ESP32
  WiFi.mode(WIFI_MODE_MAX);
  WiFi.mode(WIFI_MODE_NULL);
#endif

  // Serial port for debugging purposes
  Serial.begin(SERIAL_BAUD_RATE);
  
  // Initialize SPIFFS
  if (!SPIFFS.begin())
  {
    Serial.println("An Error has occurred while mounting SPIFFS");
    return;
  }

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(1000);
    Serial.println(".");
  }

  // Print ESP8266 Local IP Address
  Serial.println(WiFi.localIP());

  // Route for root / web page
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(SPIFFS, "/index.html");
  });
  server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(SPIFFS, "/script.js", "text/javascript");
  });

  server.on("/style.js", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(SPIFFS, "/style.cs", "text/css");
  });

  server.on("/voltage", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send_P(200, "text/plain", String(getVoltage()).c_str());
  });
  server.on("/current", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send_P(200, "text/plain", String(getCurrent()).c_str());
  });
  server.on("/power", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send_P(200, "text/plain", String(getPower()).c_str());
  });
  server.on("/energy", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send_P(200, "text/plain", String(getEnergy()).c_str());
  });
  server.on("/energytraiff", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send_P(200, "text/plain", String(getEnergyTraiff()).c_str());
  });
  server.on("/energybill", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send_P(200, "text/plain", String(getEnergyBill()).c_str());
  });
  // Start server
  server.begin();
}

void loop()
{
}
