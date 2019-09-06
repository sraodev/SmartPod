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

#define MAX_SP_STATUS_SIZE 1024
#define SP_STATUS_SERVICE_PATH "/rest/ntpStatus"

class SmartPodStatus
{

public:
    SmartPodStatus(AsyncWebServer *server, SecurityManager* securityManager);
    ~SmartPodStatus();

private:
    AsyncWebServer *_server;
    SecurityManager* _securityManager;

    void spStatus(AsyncWebServerRequest *request);
};
#endif /* SMARTPODSTATUS_H */
