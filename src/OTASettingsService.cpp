#include <OTASettingsService.h>
#include <FirmwareLog.h>

OTASettingsService::OTASettingsService(AsyncWebServer* server, FS* fs, SecurityManager* securityManager) : AdminSettingsService(server, fs, securityManager, OTA_SETTINGS_SERVICE_PATH, OTA_SETTINGS_FILE) {
#if defined(ESP8266)
  _onStationModeGotIPHandler = WiFi.onStationModeGotIP(std::bind(&OTASettingsService::onStationModeGotIP, this, std::placeholders::_1));
#elif defined(ESP_PLATFORM)
  WiFi.onEvent(std::bind(&OTASettingsService::onStationModeGotIP, this, std::placeholders::_1, std::placeholders::_2), WiFiEvent_t::SYSTEM_EVENT_STA_GOT_IP);
#endif
}

OTASettingsService::~OTASettingsService() {}

void OTASettingsService::loop() {
  if (_enabled && _arduinoOTA){
    _arduinoOTA->handle();
  }
}

void OTASettingsService::onConfigUpdated() {
  configureArduinoOTA();
}

void OTASettingsService::readFromJsonObject(JsonObject& root) {
  _enabled = root["enabled"];
  _port = root["port"];
  _password = root["password"] | DEFAULT_OTA_PASSWORD;

  // provide defaults
  if (_port < 0){
    _port = DEFAULT_OTA_PORT;
  }
}

void OTASettingsService::writeToJsonObject(JsonObject& root) {
  root["enabled"] = _enabled;
  root["port"] = _port;
  root["password"] = _password;
}

void OTASettingsService::configureArduinoOTA() {
  if (_arduinoOTA){
#if defined(ESP_PLATFORM)
    _arduinoOTA->end();
#endif
    delete _arduinoOTA;
    _arduinoOTA = nullptr;
  }
  if (_enabled) {
    smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "ota", "starting update service");
    _arduinoOTA = new ArduinoOTAClass;
    _arduinoOTA->setPort(_port);
    _arduinoOTA->setPassword(_password.c_str());
    _arduinoOTA->onStart([]() {
      smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "ota", "update started");
    });
    _arduinoOTA->onEnd([]() {
      smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "ota", "update completed");
    });
    _arduinoOTA->onProgress([](unsigned int progress, unsigned int total) {
      const uint32_t percent = total == 0 ? 0 : static_cast<uint32_t>(
        (static_cast<uint64_t>(progress > total ? total : progress) * 100) / total);
      smartpod_logging::logger().write(smartpod_logging::LogLevel::Debug, "ota", "update progress", smartpod_logging::LogField::ProgressPercent, percent);
    });
    _arduinoOTA->onError([](ota_error_t error) {
      smartpod_logging::logger().write(smartpod_logging::LogLevel::Error, "ota", "update failed", smartpod_logging::LogField::Code, error);
    });
    _arduinoOTA->begin();
  }
}

#if defined(ESP8266)
void OTASettingsService::onStationModeGotIP(const WiFiEventStationModeGotIP& event) {
  configureArduinoOTA();
}  
#elif defined(ESP_PLATFORM)
void OTASettingsService::onStationModeGotIP(WiFiEvent_t event, WiFiEventInfo_t info) {
  configureArduinoOTA();
}  
#endif
