#include "SmartPodStatus.h"

SmartPodStatus::SmartPodStatus(AsyncWebServer *server, SmartPodService *smartpod, SecurityManager *securityManager) : _server(server), _smartpod(smartpod), _securityManager(securityManager)
{
  _server->on(SMARTPOD_STATUS_SERVICE_PATH, HTTP_GET,
              _securityManager->wrapRequest(std::bind(&SmartPodStatus::smartpodStatus, this, std::placeholders::_1), AuthenticationPredicates::IS_AUTHENTICATED));
}

SmartPodStatus::~SmartPodStatus() {}

void SmartPodStatus::smartpodStatus(AsyncWebServerRequest *request)
{
  AsyncJsonResponse *response = new AsyncJsonResponse(MAX_ESP_STATUS_SIZE);
  JsonObject root = response->getRoot();
  root["voltage"] = _smartpod->getVoltage();
  root["current"] = _smartpod->getCurrent();
  root["power"] = _smartpod->getPower();
  root["energy_usage"] = _smartpod->getEnergyUsage();
  root["energy_traiff"] = _smartpod->getEnergyTraiff();
  root["energy_bill"] = _smartpod->getEnergyBill();
  response->setLength();
  request->send(response);
}
