#include <WiFiStatus.h>
#include <FirmwareLog.h>

WiFiStatus::WiFiStatus(AsyncWebServer *server, SecurityManager* securityManager) : _server(server), _securityManager(securityManager) {
  _server->on(WIFI_STATUS_SERVICE_PATH, HTTP_GET, 
    _securityManager->wrapRequest(std::bind(&WiFiStatus::wifiStatus, this, std::placeholders::_1), AuthenticationPredicates::IS_AUTHENTICATED)
  );
#if defined(ESP8266)
  _onStationModeConnectedHandler = WiFi.onStationModeConnected(onStationModeConnected);
  _onStationModeDisconnectedHandler = WiFi.onStationModeDisconnected(onStationModeDisconnected);
  _onStationModeGotIPHandler = WiFi.onStationModeGotIP(onStationModeGotIP);
#elif defined(ESP_PLATFORM)
  WiFi.onEvent(onStationModeConnected, WiFiEvent_t::SYSTEM_EVENT_STA_CONNECTED); 
  WiFi.onEvent(onStationModeDisconnected, WiFiEvent_t::SYSTEM_EVENT_STA_DISCONNECTED); 
  WiFi.onEvent(onStationModeGotIP, WiFiEvent_t::SYSTEM_EVENT_STA_GOT_IP); 
#endif
}

#if defined(ESP8266)
void WiFiStatus::onStationModeConnected(const WiFiEventStationModeConnected& event) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "wifi", "connected");
}

void WiFiStatus::onStationModeDisconnected(const WiFiEventStationModeDisconnected& event) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Warn, "wifi", "disconnected", smartpod_logging::LogField::Code, event.reason);
}

void WiFiStatus::onStationModeGotIP(const WiFiEventStationModeGotIP& event) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "wifi", "address acquired");
}
#elif defined(ESP_PLATFORM)
void WiFiStatus::onStationModeConnected(WiFiEvent_t event, WiFiEventInfo_t info) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "wifi", "connected");
}

void WiFiStatus::onStationModeDisconnected(WiFiEvent_t event, WiFiEventInfo_t info) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Warn, "wifi", "disconnected", smartpod_logging::LogField::Code, info.disconnected.reason);
}

void WiFiStatus::onStationModeGotIP(WiFiEvent_t event, WiFiEventInfo_t info) {
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "wifi", "address acquired");
}
#endif

void WiFiStatus::wifiStatus(AsyncWebServerRequest *request) {
  AsyncJsonResponse * response = new AsyncJsonResponse(MAX_WIFI_STATUS_SIZE);
  JsonObject root = response->getRoot();
  wl_status_t status = WiFi.status();
  root["status"] = (uint8_t) status;
  if (status == WL_CONNECTED){
    root["local_ip"] = WiFi.localIP().toString();
    root["mac_address"] = WiFi.macAddress();
    root["rssi"] = WiFi.RSSI();
    root["ssid"] = WiFi.SSID();
    root["bssid"] = WiFi.BSSIDstr();
    root["channel"] = WiFi.channel();
    root["subnet_mask"] = WiFi.subnetMask().toString();
    root["gateway_ip"] = WiFi.gatewayIP().toString();
    IPAddress dnsIP1 = WiFi.dnsIP(0);
    IPAddress dnsIP2 = WiFi.dnsIP(1);
    if (dnsIP1 != INADDR_NONE){
      root["dns_ip_1"] = dnsIP1.toString();
    }
    if (dnsIP2 != INADDR_NONE){
      root["dns_ip_2"] = dnsIP2.toString();
    }
  }
  response->setLength();
  request->send(response);
}
