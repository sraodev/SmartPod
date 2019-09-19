#ifndef SMARTPOD_H
#define SMARTPOD_H

#include <Arduino.h>

#if defined(ESP8266)
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#elif defined(ESP_PLATFORM)
#include <WiFi.h>
#include <AsyncTCP.h>
#include <SPIFFS.h>
#endif

#include <FS.h>
#include <SecuritySettingsService.h>
#include <WiFiSettingsService.h>
#include <APSettingsService.h>
#include <NTPSettingsService.h>
#include <OTASettingsService.h>
#include <AuthenticationService.h>
#include <WiFiScanner.h>
#include <WiFiStatus.h>
#include <NTPStatus.h>
#include <APStatus.h>
#include <SystemStatus.h>
#include <SmartPodStatus.h>

#define SERIAL_BAUD_RATE 115200

class SmartPod
{

public:
  SmartPod();
  ~SmartPod();

  void begin();
  void loop();

private:
  // Create AsyncWebServer object on port 80
  AsyncWebServer *_server;
  SecuritySettingsService *_securitySettingsService;
  WiFiSettingsService *_wifiSettingsService;
  APSettingsService *_apSettingsService;
  NTPSettingsService *_ntpSettingsService;
  OTASettingsService *_otaSettingsService;
  AuthenticationService *_authenticationService;
  SmartPodService *_smartpodService;

  WiFiScanner *_wifiScanner;
  WiFiStatus *_wifiStatus;
  NTPStatus *_ntpStatus;
  APStatus *_apStatus;
  SystemStatus *_systemStatus;
  SmartPodStatus *_smartpodStatus;

  void connectToWiFi();
  void mountSPIFFS();
  void setServerStaticResource(AsyncWebServer *server);
};
#endif /* SMARTPOD_H */
