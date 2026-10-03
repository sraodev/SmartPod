#include <APSettingsService.h>
#include <FirmwareLog.h>

APSettingsService::APSettingsService(AsyncWebServer *server, FS *fs, SecurityManager *securityManager) : AdminSettingsService(server, fs, securityManager, AP_SETTINGS_SERVICE_PATH, AP_SETTINGS_FILE)
{
  onConfigUpdated();
}

APSettingsService::~APSettingsService() {}

void APSettingsService::loop()
{
  unsigned long currentMillis = millis();
  unsigned long manageElapsed = (unsigned long)(currentMillis - _lastManaged);
  if (manageElapsed >= MANAGE_NETWORK_DELAY)
  {
    _lastManaged = currentMillis;
    manageAP();
  }
  handleDNS();
}

void APSettingsService::manageAP()
{
  WiFiMode_t currentWiFiMode = WiFi.getMode();
  if (!_securityManager->isProvisioned() || _provisionMode == AP_MODE_ALWAYS || (_provisionMode == AP_MODE_DISCONNECTED && WiFi.status() != WL_CONNECTED))
  {
    if (currentWiFiMode == WIFI_OFF || currentWiFiMode == WIFI_STA)
    {
      startAP();
    }
  }
  else
  {
    if (currentWiFiMode == WIFI_AP || currentWiFiMode == WIFI_AP_STA)
    {
      stopAP();
    }
  }
}

void APSettingsService::startAP()
{
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "ap", "starting access point");
  if (_securityManager->isProvisioned()) {
    WiFi.softAP(_ssid.c_str(), _password.c_str());
  } else {
#if defined(ESP8266)
    const String provisioningSsid = String("SmartPod-Setup-") + String(ESP.getChipId(), HEX);
#else
    const String provisioningSsid = "SmartPod-Setup";
#endif
    WiFi.softAP(provisioningSsid.c_str());
  }
  if (!_dnsServer)
  {
    IPAddress apIp = WiFi.softAPIP();
    smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "ap", "starting captive portal");
    _dnsServer = new DNSServer;
    _dnsServer->start(DNS_PORT, "*", apIp);
  }
}

void APSettingsService::stopAP()
{
  if (_dnsServer)
  {
    smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "ap", "stopping captive portal");
    _dnsServer->stop();
    delete _dnsServer;
    _dnsServer = nullptr;
  }
  smartpod_logging::logger().write(smartpod_logging::LogLevel::Info, "ap", "stopping access point");
  WiFi.softAPdisconnect(true);
}

void APSettingsService::handleDNS()
{
  if (_dnsServer)
  {
    _dnsServer->processNextRequest();
  }
}

void APSettingsService::readFromJsonObject(JsonObject &root)
{
  _provisionMode = root["provision_mode"] | AP_MODE_ALWAYS;
  switch (_provisionMode)
  {
  case AP_MODE_ALWAYS:
  case AP_MODE_DISCONNECTED:
  case AP_MODE_NEVER:
    break;
  default:
    _provisionMode = AP_MODE_ALWAYS;
  }
  _ssid = root["ssid"] | AP_DEFAULT_SSID;
  _password = root["password"] | "";
  if (_securityManager->isProvisioned() && _provisionMode != AP_MODE_NEVER &&
      (_password.length() < 8 || _password.length() > 63))
  {
    _provisionMode = AP_MODE_NEVER;
    _password = "";
  }
}

void APSettingsService::writeToJsonObject(JsonObject &root)
{
  root["provision_mode"] = _provisionMode;
  root["ssid"] = _ssid;
  root["password"] = _password;
}

void APSettingsService::readFromUpdateJsonObject(JsonObject &root)
{
  const String previousPassword = _password;
  readFromJsonObject(root);
  const String requestedPassword = root["password"] | "";
  if (requestedPassword.length() == 0) _password = previousPassword;
}

void APSettingsService::writeToResponseJsonObject(JsonObject &root)
{
  root["provision_mode"] = _provisionMode;
  root["ssid"] = _ssid;
  root["password"] = "";
  root["password_set"] = _password.length() > 0;
}

void APSettingsService::onConfigUpdated()
{
  _lastManaged = millis() - MANAGE_NETWORK_DELAY;

  // stop softAP - forces reconfiguration in loop()
  stopAP();
}
