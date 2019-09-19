#include <Arduino.h>
#include "SmartPod.h"

SmartPod::SmartPod()
{
    _server = new AsyncWebServer(80);

    _securitySettingsService = new SecuritySettingsService(_server, &SPIFFS);
    _wifiSettingsService = new WiFiSettingsService(_server, &SPIFFS, _securitySettingsService);
    _apSettingsService = new APSettingsService(_server, &SPIFFS, _securitySettingsService);
    _ntpSettingsService = new NTPSettingsService(_server, &SPIFFS, _securitySettingsService);
    _otaSettingsService = new OTASettingsService(_server, &SPIFFS, _securitySettingsService);
    _authenticationService = new AuthenticationService(_server, _securitySettingsService);
    _smartpodService = new SmartPodService(_server, &SPIFFS, _securitySettingsService);

    _wifiScanner = new WiFiScanner(_server, _securitySettingsService);
    _wifiStatus = new WiFiStatus(_server, _securitySettingsService);
    _ntpStatus = new NTPStatus(_server, _securitySettingsService);
    _apStatus = new APStatus(_server, _securitySettingsService);
    _systemStatus = new SystemStatus(_server, _securitySettingsService);
    _smartpodStatus = new SmartPodStatus(_server, _smartpodService, _securitySettingsService);
}

SmartPod::~SmartPod() {}

void SmartPod::begin()
{

    // Serial port for debugging purposes
    Serial.begin(SERIAL_BAUD_RATE);

    connectToWiFi();
    mountSPIFFS();

    // Start security settings service first
    _securitySettingsService->begin();

    // Start services
    Serial.print("[SmartPod] Starting NTP Service...\t\t\t");
    _ntpSettingsService->begin();
    Serial.println("[Done]");

    Serial.print("[SmartPod] Starting OTA Service...\t\t\t");
    _otaSettingsService->begin();
    Serial.println("[Done]");

    Serial.print("[SmartPod] Starting AP Service...\t\t\t");
    _apSettingsService->begin();
    Serial.println("[Done]");

    Serial.print("[SmartPod] Starting WiFi Service...\t\t\t");
    _wifiSettingsService->begin();
    Serial.println("[Done]");

    setServerStaticResource(_server);

    // Start server
    _server->begin();
    _smartpodService->begin();
}

void SmartPod::connectToWiFi()
{
    // Disable wifi config persistance and auto reconnect
    WiFi.persistent(false);
    WiFi.setAutoReconnect(false);

#if defined(ESP_PLATFORM)
    // Init the wifi driver on ESP32
    WiFi.mode(WIFI_MODE_MAX);
    WiFi.mode(WIFI_MODE_NULL);
#endif
}

/*!
 *  @brief  Mounts SPIFFS file system
 */
void SmartPod::mountSPIFFS()
{
    Serial.println("[SmartPod] Starting SPIFFS Service...");
    Serial.print("[SmartPod] Mounting SPIFFS file system...\t\t\t");
    if (!SPIFFS.begin())
    {
        Serial.println("An Error has occurred while mounting SPIFFS");
        return;
    }
    Serial.println("[Done]");
}

void SmartPod::setServerStaticResource(AsyncWebServer *server)
{
    // Serving static resources from /www/
    server->serveStatic("/js/", SPIFFS, "/www/js/");
    server->serveStatic("/css/", SPIFFS, "/www/css/");
    server->serveStatic("/fonts/", SPIFFS, "/www/fonts/");
    server->serveStatic("/app/", SPIFFS, "/www/app/");
    server->serveStatic("/favicon.ico", SPIFFS, "/www/favicon.ico");

    // Serving all other get requests with "/www/index.htm"
    // OPTIONS get a straight up 200 response
    server->onNotFound([](AsyncWebServerRequest *request) {
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
}

void SmartPod::loop()
{
    _wifiSettingsService->loop();
    _apSettingsService->loop();
    _ntpSettingsService->loop();
    _otaSettingsService->loop();
    delay(50);
    _smartpodService->loop();
}
