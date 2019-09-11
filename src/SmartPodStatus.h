#ifndef SMARTPODSTATUS_H
#define SMARTPODSTATUS_H

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESPAsyncTCP.h>
#elif defined(ESP_PLATFORM)
  #include <WiFi.h>
  #include <AsyncTCP.h>
#endif

#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <AsyncArduinoJson6.h>
#include <SecurityManager.h>

#define MAX_ESP_STATUS_SIZE 1024
 
#define MAX_SMARTPOD_STATUS_SIZE 1024
#define SMARTPOD_STATUS_SERVICE_PATH "/rest/smartpodStatus"

class SmartPodStatus
{

public:
    SmartPodStatus(AsyncWebServer *server, SecurityManager* securityManager);
    ~SmartPodStatus();

private:
    AsyncWebServer *_server;
    SecurityManager* _securityManager;

    void smartpodStatus(AsyncWebServerRequest *request);
};
#endif /* SMARTPODSTATUS_H */
