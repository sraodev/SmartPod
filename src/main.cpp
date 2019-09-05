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
#include <SmartPodService.h>

#define SERIAL_BAUD_RATE 115200

// Create AsyncWebServer object on port 80
AsyncWebServer server(80);

// Replace with your network credentials
const char *ssid = "SriFi";
const char *password = "flying_cheetah_with_a_jetpack_421";

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

  // TODO: Start security settings service first
  //securitySettingsService.begin();

  // TODO: Start services
  //ntpSettingsService.begin();
  //otaSettingsService.begin();
  //apSettingsService.begin();
  //wifiSettingsService.begin();

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

  // Serving static resources from /www/
  server.serveStatic("/js/", SPIFFS, "/www/js/");
  server.serveStatic("/css/", SPIFFS, "/www/css/");
  server.serveStatic("/fonts/", SPIFFS, "/www/fonts/");
  server.serveStatic("/app/", SPIFFS, "/www/app/");
  server.serveStatic("/favicon.ico", SPIFFS, "/www/favicon.ico");

  // Serving all other get requests with "/www/index.htm"
  // OPTIONS get a straight up 200 response
  server.onNotFound([](AsyncWebServerRequest *request) {
    if (request->method() == HTTP_GET)
    {
      request->send(SPIFFS, "/www/index.html");
    }
    else if (request->method() == HTTP_OPTIONS)
    {
      request->send(200);
    }
    else
    {
      request->send(404);
    }
  });

  // Disable CORS if required
#if defined(ENABLE_CORS)
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Credentials", "true");
#endif

  // Start server
  server.begin();
}

void loop()
{
}
