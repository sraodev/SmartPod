#include <SecuritySettingsService.h>

#if defined(ESP8266)
extern "C" {
#include <user_interface.h>
}
#elif defined(ESP_PLATFORM)
#include <esp_system.h>
#endif

SecuritySettingsService::SecuritySettingsService(AsyncWebServer* server, FS* fs) : AdminSettingsService(server, fs, this, SECURITY_SETTINGS_PATH, SECURITY_SETTINGS_FILE), SecurityManager() {
  _provisioningHandler.setUri(PROVISIONING_PATH);
  _provisioningHandler.setMethod(HTTP_POST);
  _provisioningHandler.setMaxContentLength(MAX_SETTINGS_SIZE);
  _provisioningHandler.onRequest(std::bind(&SecuritySettingsService::provision, this, std::placeholders::_1, std::placeholders::_2));
  server->addHandler(&_provisioningHandler);

  server->on(SECURITY_RESET_PATH, HTTP_POST,
    wrapRequest(std::bind(&SecuritySettingsService::resetProvisioning, this, std::placeholders::_1), AuthenticationPredicates::IS_ADMIN));
}
SecuritySettingsService::~SecuritySettingsService() {}

void SecuritySettingsService::readFromJsonObject(JsonObject& root) {
  const bool markerPresent = root.containsKey("provisioned");
  const bool markerValue = root["provisioned"] | false;
  const String storedSecret = root["jwt_secret"] | "";
  std::list<User> storedUsers;
  bool hasAdmin = false;
  if (root["users"].is<JsonArray>()) {
    for (JsonVariant user :  root["users"].as<JsonArray>()) {
      User stored(user["username"], user["password"], user["admin"]);
      hasAdmin = hasAdmin || stored.isAdmin();
      storedUsers.push_back(stored);
    }
  }

  const smartpod_security::BootDecision decision = smartpod_security::decideBoot(
    markerPresent, markerValue, storedSecret == LEGACY_DEFAULT_JWT_SECRET,
    storedSecret.length() > 0, hasAdmin);
  _provisioned = decision.provisioned;
  _users = decision.clearUsers ? std::list<User>() : storedUsers;
  _jwtHandler.setSecret(decision.rotateSecret ? "" : storedSecret);
  _needsPersistence = !markerPresent || decision.rotateSecret || decision.clearUsers;

  if (decision.rotateSecret && !generateSecret()) {
    _provisioned = false;
    _users.clear();
  }
}

void SecuritySettingsService::writeToJsonObject(JsonObject& root) {
  root["provisioned"] = _provisioned;
  root["jwt_secret"] = _jwtHandler.getSecret();
  JsonArray users = root.createNestedArray("users");
  for (User _user : _users) {
    JsonObject user = users.createNestedObject();
    user["username"] = _user.getUsername();
    user["password"] = _user.getPassword();
    user["admin"] = _user.isAdmin();
  }
}

void SecuritySettingsService::writeToResponseJsonObject(JsonObject& root) {
  root["provisioned"] = _provisioned;
  root["jwt_secret"] = "";
  root["jwt_secret_set"] = _jwtHandler.getSecret().length() > 0;
  JsonArray users = root.createNestedArray("users");
  for (User userValue : _users) {
    JsonObject user = users.createNestedObject();
    user["username"] = userValue.getUsername();
    user["password"] = "";
    user["password_set"] = userValue.getPassword().length() > 0;
    user["admin"] = userValue.isAdmin();
  }
}

void SecuritySettingsService::readFromUpdateJsonObject(JsonObject& root) {
  if (!generateSecret()) return;

  if (!root["users"].is<JsonArray>()) return;
  const std::list<User> previousUsers = _users;
  std::list<User> updatedUsers;
  bool hasAdmin = false;
  for (JsonVariant value : root["users"].as<JsonArray>()) {
    const String username = value["username"] | "";
    String password = value["password"] | "";
    if (!smartpod_security::validUsername(username.c_str())) continue;
    if (password.length() == 0) {
      for (User existing : previousUsers) {
        if (existing.getUsername() == username) {
          password = existing.getPassword();
          break;
        }
      }
    }
    if (!smartpod_security::validPassword(password.c_str())) continue;
    const bool admin = value["admin"] | false;
    hasAdmin = hasAdmin || admin;
    updatedUsers.push_back(User(username, password, admin));
  }
  if (hasAdmin) _users = updatedUsers;
}

bool SecuritySettingsService::generateSecret() {
  uint8_t randomBytes[32];
#if defined(ESP8266)
  if (os_get_random(randomBytes, sizeof(randomBytes)) != 0) return false;
#elif defined(ESP_PLATFORM)
  esp_fill_random(randomBytes, sizeof(randomBytes));
#else
  return false;
#endif
  static const char hex[] = "0123456789abcdef";
  char secret[65];
  for (size_t index = 0; index < sizeof(randomBytes); ++index) {
    secret[index * 2] = hex[randomBytes[index] >> 4];
    secret[index * 2 + 1] = hex[randomBytes[index] & 0x0f];
  }
  secret[64] = '\0';
  _jwtHandler.setSecret(secret);
  return true;
}

void SecuritySettingsService::provision(AsyncWebServerRequest *request, JsonDocument &jsonDocument) {
  if (_provisioned) {
    request->send(409);
    return;
  }
  if (request->client()->localIP() != WiFi.softAPIP()) {
    request->send(403);
    return;
  }
  if (!jsonDocument.is<JsonObject>()) {
    request->send(400);
    return;
  }
  JsonObject root = jsonDocument.as<JsonObject>();
  const String username = root["username"] | "";
  const String password = root["password"] | "";
  if (!smartpod_security::validUsername(username.c_str()) ||
      !smartpod_security::validPassword(password.c_str()) ||
      _jwtHandler.getSecret().length() == 0) {
    request->send(400);
    return;
  }

  const std::list<User> previousUsers = _users;
  _users.clear();
  _users.push_back(User(username, password, true));
  _provisioned = true;
  if (!writeToFS()) {
    _users = previousUsers;
    _provisioned = false;
    request->send(500);
    return;
  }
  request->send(204);
}

void SecuritySettingsService::resetProvisioning(AsyncWebServerRequest *request) {
  const String previousSecret = _jwtHandler.getSecret();
  const std::list<User> previousUsers = _users;
  const smartpod_security::BootDecision decision = smartpod_security::resetDecision();
  if (decision.rotateSecret && !generateSecret()) {
    request->send(500);
    return;
  }
  if (decision.clearUsers) _users.clear();
  _provisioned = decision.provisioned;
  if (!writeToFS()) {
    _jwtHandler.setSecret(previousSecret);
    _users = previousUsers;
    _provisioned = true;
    request->send(500);
    return;
  }
  request->send(204);
}

void SecuritySettingsService::begin() {
  readFromFS();
  if (_needsPersistence && _jwtHandler.getSecret().length() > 0 && !writeToFS()) {
    _provisioned = false;
    _users.clear();
  }
}
