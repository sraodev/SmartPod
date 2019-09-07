#include "SmartPodStatus.h"

SmartPodStatus::SmartPodStatus(AsyncWebServer *server, SecurityManager* securityManager) : _server(server), _securityManager(securityManager) {
  _server->on(SP_STATUS_SERVICE_PATH, HTTP_GET, 
    _securityManager->wrapRequest(std::bind(&SmartPodStatus::spStatus, this, std::placeholders::_1), AuthenticationPredicates::IS_AUTHENTICATED)
  );
}

SmartPodStatus::~SmartPodStatus(){}

void SmartPodStatus::spStatus(AsyncWebServerRequest *request){
    AsyncJsonResponse * response = new AsyncJsonResponse(MAX_SP_STATUS_SIZE);
    JsonObject root = response->getRoot();
    
    response->setLength();
    request->send(response);

}

