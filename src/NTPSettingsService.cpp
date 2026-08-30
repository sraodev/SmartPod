#include <NTPSettingsService.h>
#include <FirmwareLog.h>

NTPSettingsService::NTPSettingsService(AsyncWebServer* server, FS* fs, SecurityManager* securityManager) : AdminSettingsService(server, fs, securityManager, NTP_SETTINGS_SERVICE_PATH, NTP_SETTINGS_FILE) {

#if defined(ESP8266)
  _onStationModeDisconnectedHandler = WiFi.onStationModeDisconnected(std::bind(&NTPSettingsService::onStationModeDisconnected, this, std::placeholders::_1));
  _onStationModeGotIPHandler = WiFi.onStationModeGotIP(std::bind(&NTPSettingsService::onStationModeGotIP, this, std::placeholders::_1));
#elif defined(ESP_PLATFORM)
  WiFi.onEvent(std::bind(&NTPSettingsService::onStationModeDisconnected, this, std::placeholders::_1, std::placeholders::_2), WiFiEvent_t::SYSTEM_EVENT_STA_DISCONNECTED); 
  WiFi.onEvent(std::bind(&NTPSettingsService::onStationModeGotIP, this, std::placeholders::_1, std::placeholders::_2), WiFiEvent_t::SYSTEM_EVENT_STA_GOT_IP);
#endif

  NTP.onNTPSyncEvent ([this](NTPSyncEvent_t ntpEvent) {
    _ntpEvent = ntpEvent;
    _syncEventTriggered = true;
  });
}

NTPSettingsService::~NTPSettingsService() {}

void NTPSettingsService::loop() {
  // detect when we need to re-configure NTP and do it in the main loop
  if (_reconfigureNTP) {
    _reconfigureNTP = false;
    configureNTP();
  }

  // output sync event to serial
  if (_syncEventTriggered) {
    processSyncEvent(_ntpEvent);
    _syncEventTriggered = false;
  }

  // keep time synchronized in background
  now();
}

void NTPSettingsService::readFromJsonObject(JsonObject& root) {
  _server = root["server"] | NTP_SETTINGS_SERVICE_DEFAULT_SERVER;
  _interval = root["interval"];

  // validate server is specified, resorting to default
  _server.trim();
  if (!_server){
    _server = NTP_SETTINGS_SERVICE_DEFAULT_SERVER;
  }

  // make sure interval is in bounds
  if (_interval < NTP_SETTINGS_MIN_INTERVAL){
    _interval = NTP_SETTINGS_MIN_INTERVAL;
  } else if (_interval > NTP_SETTINGS_MAX_INTERVAL) {
    _interval = NTP_SETTINGS_MAX_INTERVAL;
  }
}

void NTPSettingsService::writeToJsonObject(JsonObject& root) {
  root["server"] = _server;
  root["interval"] = _interval;
}

void NTPSettingsService::onConfigUpdated() {
  _reconfigureNTP = true;
}

#if defined(ESP8266)
void NTPSettingsService::onStationModeGotIP(const WiFiEventStationModeGotIP& event) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Debug, "ntp", "synchronization scheduled");
  _reconfigureNTP = true;
}

void NTPSettingsService::onStationModeDisconnected(const WiFiEventStationModeDisconnected& event) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Debug, "ntp", "stopped after disconnect");
  _reconfigureNTP = false;
  NTP.stop();
}
#elif defined(ESP_PLATFORM)
void NTPSettingsService::onStationModeGotIP(WiFiEvent_t event, WiFiEventInfo_t info) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Debug, "ntp", "synchronization scheduled");
  _reconfigureNTP = true;
}

void NTPSettingsService::onStationModeDisconnected(WiFiEvent_t event, WiFiEventInfo_t info) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Debug, "ntp", "stopped after disconnect");
  _reconfigureNTP = false;
  NTP.stop();
}
#endif

void NTPSettingsService::configureNTP() {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Debug, "ntp", "configuring synchronization");

  // disable sync
  NTP.stop();

  // enable sync
  NTP.begin(_server);
  NTP.setInterval(_interval);
}

void NTPSettingsService::processSyncEvent(NTPSyncEvent_t ntpEvent) {
    if (ntpEvent) {
        if (ntpEvent == noResponse)
            smartpod_logging::logger().write(smartpod_logging::LogLevel::Warn, "ntp", "server unreachable");
        else if (ntpEvent == invalidAddress)
            smartpod_logging::logger().write(smartpod_logging::LogLevel::Warn, "ntp", "invalid server address");
        else
            smartpod_logging::logger().write(smartpod_logging::LogLevel::Warn, "ntp", "synchronization failed", smartpod_logging::LogField::Code, ntpEvent);
    } else {
        smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "ntp", "synchronized");
    }
}
