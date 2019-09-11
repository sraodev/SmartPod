#include "SmartPodStatus.h"

SmartPodStatus::SmartPodStatus(AsyncWebServer *server, SecurityManager* securityManager) : _server(server), _securityManager(securityManager) {
  _server->on(SMARTPOD_STATUS_SERVICE_PATH, HTTP_GET, 
    _securityManager->wrapRequest(std::bind(&SmartPodStatus::smartpodStatus, this, std::placeholders::_1), AuthenticationPredicates::IS_AUTHENTICATED)
  );
}

SmartPodStatus::~SmartPodStatus(){}

void SmartPodStatus::smartpodStatus(AsyncWebServerRequest *request){
  AsyncJsonResponse * response = new AsyncJsonResponse(MAX_ESP_STATUS_SIZE);
  JsonObject root = response->getRoot();
  root["voltage"] = ESP.getCpuFreqMHz();  
  root["current"] = ESP.getCpuFreqMHz();  
  root["power"] = ESP.getFreeHeap();
  root["energy_usage"] = ESP.getSketchSize();
  root["energy_traiff"] = ESP.getFreeSketchSpace();
  root["energy_bill"] = ESP.getSdkVersion();
  response->setLength();
  request->send(response);
    

}

