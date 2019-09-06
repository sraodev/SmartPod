#ifndef SMARTPOD_H
#define SMARTPOD_H


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
#include <SmartPodStatus.h>

#define SERIAL_BAUD_RATE 115200

class SmartPod {

public:
    SmartPod();
    ~SmartPod();

    void begin();
    void loop();
private:
    // Create AsyncWebServer object on port 80
    AsyncWebServer* _server; 
    SecuritySettingsService* _securitySettingsService;
    SmartPodStatus* _spStatus;

    void connectToWiFi();
    void mountSPIFFS();
    void setServerStaticResource(AsyncWebServer* server);
};
#endif /* SMARTPOD_H */
