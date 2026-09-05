#ifndef SecuritySettingsService_h
#define SecuritySettingsService_h

#include <SettingsService.h>
#include <SecurityManager.h>
#include <ProvisioningPolicy.h>

#define SECURITY_SETTINGS_FILE "/config/securitySettings.json"
#define SECURITY_SETTINGS_PATH "/rest/securitySettings"
#define PROVISIONING_PATH "/rest/provision"
#define SECURITY_RESET_PATH "/rest/securitySettings/reset"

class SecuritySettingsService : public AdminSettingsService, public SecurityManager {

  public:

    SecuritySettingsService(AsyncWebServer* server, FS* fs);
    ~SecuritySettingsService();

    void begin();

  protected:

    void readFromJsonObject(JsonObject& root);
    void writeToJsonObject(JsonObject& root);
    void readFromUpdateJsonObject(JsonObject& root);
    void writeToResponseJsonObject(JsonObject& root);

  private:

    AsyncJsonWebHandler _provisioningHandler;
    bool _needsPersistence = false;

    bool generateSecret();
    void provision(AsyncWebServerRequest *request, JsonDocument &jsonDocument);
    void resetProvisioning(AsyncWebServerRequest *request);

};

#endif // end SecuritySettingsService_h
