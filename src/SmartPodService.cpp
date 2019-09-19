/*!
 *  @file SmartPod.cpp
 *
 *  Voltage & Current Unified Sensor Library
 *
 *  This is a library for AC series of low cost voltage/current sensors.
 */

#include <SmartPodService.h>

std::map<std::string, ACS712_type> ACS712Type = {
    {"ACS712_05B", ACS712_type::ACS712_05B},
    {"ACS712_20A", ACS712_type::ACS712_20A},
    {"ACS712_30A", ACS712_type::ACS712_30A}};

/*!
 *  @brief  Instantiates a new  SmartPod class
 *  @param  pin
 *          pin number that sensor is connected
 *  @param  type
 *          type of sensor
 *  @param  count
 *          number of sensors
 *  @param  currentSensorId
 *          current sensor id
 *  @param  voltageSensorId
 *          voltage sensor id
 */
SmartPodService::SmartPodService(AsyncWebServer *server, FS *fs, SecurityManager *securityManager) : AdminSettingsService(server, fs, securityManager, SMARTPOD_SETTINGS_SERVICE_PATH, SMARTPOD_SETTINGS_FILE)
{
}

SmartPodService::~SmartPodService() {}

/*!
 *  @brief  Setup sensor (calls begin on It)
 */
void SmartPodService::begin()
{
  Serial.print("[SmartPod] Setting Smartpod Service... \t\t\t");
  SettingsService::begin();
  Serial.println("[Done]");
  Serial.print("[SmartPod] Starting Smartpod Service...\t\t\t");
  //_acs712 = new ACS712(_sensor_type, _sensor_pin);
  _acs712 = new ACS712(_sensor_type, A0);

  // calibrate() method calibrates zero point of sensor,
  // It is not necessary, but may positively affect the accuracy
  // Ensure that no current flows through the sensor at this moment
  // If you are not sure that the current through the sensor will not leak during calibration - comment out this method
  //Serial.print("[SmartPod] Calibrating smartpod sensor.. Ensure that no current flows through the sensor at this moment: ");
  _acs712->calibrate();
  //Serial.println("Done!");
  getSmartPodSensor(&_sp_sensor);
  Serial.println("[Done]");
}

void SmartPodService::loop()
{
  //Serial.print("[SmartPod] Running smartpod service...");
  getSmartPodEvent(&_sp_sensor_event);
}

/*!
 *  @brief  Reads the sensor and returns the data as a sp_sensors_event_t
 *  @param  event
 *  @return always returns true
 */
bool SmartPodService::getSmartPodEvent(sp_sensors_event_t *sp_event)
{
  // Populate sensor reading values.
  getEvent(&(sp_event->sensor));
  sp_event->version = sizeof(sp_sensors_event_t);
  sp_event->timestamp = millis();
  sp_event->power = sp_event->voltage * sp_event->sensor.current;
  sp_event->energyUsage = 0;  // TODO: Need to calculate
  sp_event->energyTraiff = 0; // TODO: Need to read from JSON file
  sp_event->energyBill = 0;   // TODO: Need to calcualte

  return true;
}

void SmartPodService::getSmartPodSensor(sensor_t *sensor)
{
  getSensor(sensor);
}

/*!
 *  @brief  Sets sensor name
 *  @param  sensor
 *          Sensor that will be set
 */
void SmartPodService::setName(sensor_t *sensor)
{
  switch (_sensor_type)
  {
  case ACS712_05B:
    strncpy(sensor->name, "ACS712_05B", sizeof(sensor->name) - 1);
    break;
  case ACS712_20A:
    strncpy(sensor->name, "ACS712_20A", sizeof(sensor->name) - 1);
    break;
  case ACS712_30A:
    strncpy(sensor->name, "ACS712_30A", sizeof(sensor->name) - 1);
    break;
  default:
    // TODO: Perhaps this should be an error?  However main ACS712 library doesn't enforce
    // restrictions on the sensor type value.  Pick a generic name for now.
    strncpy(sensor->name, "ACS712?", sizeof(sensor->name) - 1);
    break;
  }
  sensor->name[sizeof(sensor->name) - 1] = 0;
}

/*!
 *  @brief  Sets Minimum Delay Value
 *  @param  sensor
 *          Sensor that will be set
 */
void SmartPodService::setMinDelay(sensor_t *sensor)
{
  switch (_sensor_type)
  {
  case ACS712_05B:
    sensor->min_delay = 1000000L; // 1 second (in microseconds)
    break;
  case ACS712_20A:
    sensor->min_delay = 2000000L; // 2 second (in microseconds)
    break;
  case ACS712_30A:
    sensor->min_delay = 2000000L; // 2 seconds (in microseconds)
    break;
  default:
    // Default to slowest sample rate in case of unknown type.
    sensor->min_delay = 2000000L; // 2 seconds (in microseconds)
    break;
  }
}

/*!
 *  @brief  Reads the sensor and returns the data as a sensors_event_t
 *  @param  event
 *  @return always returns true
 */
bool SmartPodService::getEvent(sensors_event_t *event)
{
  // Clear event definition.
  memset(event, 0, sizeof(sensors_event_t));
  // Populate sensor reading values.
  event->version = sizeof(sensors_event_t);
  event->sensor_id = _sensor_id;
  event->type = SENSOR_TYPE_CURRENT;
  event->timestamp = millis();
  event->current = _acs712->getCurrentAC(DEFAULT_SMARTPOD_FREQUENCY);

  return true;
}

/*!
 *  @brief  Provides the sensor_t data for this sensor
 *  @param  sensor
 */
void SmartPodService::getSensor(sensor_t *sensor)
{
  // Clear sensor definition.
  memset(sensor, 0, sizeof(sensor_t));
  // Set sensor name.
  setName(sensor);
  // Set version and ID
  sensor->version = ACS712_SENSOR_VERSION;
  sensor->sensor_id = _sensor_id;
  // Set type and characteristics.
  sensor->type = SENSOR_TYPE_CURRENT;
  setMinDelay(sensor);
  switch (_sensor_type)
  {
  case ACS712_05B:
    sensor->max_value = 5.0F;
    sensor->min_value = -5.0F;
    sensor->resolution = 0.054F;
    break;
  case ACS712_20A:
    sensor->max_value = 20.0F;
    sensor->min_value = -20.0F;
    sensor->resolution = 0.017F;
    break;
  case ACS712_30A:
    sensor->max_value = 30.0F;
    sensor->min_value = -30.0F;
    sensor->resolution = 0.007F;
    break;
  default:
    // Unknown type, default to 0.
    sensor->max_value = 0.0F;
    sensor->min_value = 0.0F;
    sensor->resolution = 0.0F;
    break;
  }
}

float SmartPodService::getVoltage()
{
  return _sp_sensor_event.voltage;
}

float SmartPodService::getCurrent()
{
  return _sp_sensor_event.sensor.current;
}

float SmartPodService::getPower()
{
  return _sp_sensor_event.power;
}

float SmartPodService::getEnergyUsage()
{
  return _sp_sensor_event.energyUsage;
}

float SmartPodService::getEnergyTraiff()
{
  return _sp_sensor_event.energyTraiff;
}

float SmartPodService::getEnergyBill()
{
  return _sp_sensor_event.energyBill;
}

void SmartPodService::readFromJsonObject(JsonObject &root)
{
  _sensor_type = ACS712Type[root["sensor_type"] | "ACS712_30A"];
  _sensor_pin = root["sensor_pin"] | DEFAULT_SMARTPOD_SENSOR_PIN;
  _sensor_id = root["sensor_id"] | DEFAULT_SMARTPOD_SENSOR_ID;
  _sp_sensor_event.frequency = root["frequency"] | DEFAULT_SMARTPOD_FREQUENCY;
  _sp_sensor_event.voltage = root["voltage"] | DEFAULT_SMARTPOD_VOLTAGE;
  _sp_sensor_event.sensor.current = root["current"] | DEFAULT_SMARTPOD_CURRENT;
  _sp_sensor_event.power = root["power"] | DEFAULT_SMARTPOD_POWER;
  _sp_sensor_event.energyUsage = root["energy_usage"] | DEFAULT_SMARTPOD_ENERGY_USAGE;
  _sp_sensor_event.energyTraiff = root["energy_traiff"] | DEFAULT_SMARTPOD_ENGERY_TRAIFF;
  _sp_sensor_event.energyBill = root["energy_bill"] | DEFAULT_SMARTPOD_ENGERY_BILL;
}

void SmartPodService::writeToJsonObject(JsonObject &root)
{
  // smartpod event value
  root["voltage"] = _sp_sensor_event.voltage;
  root["current"] = _sp_sensor_event.sensor.current;
  root["power"] = _sp_sensor_event.power;
  root["energy_usage"] = _sp_sensor_event.energyUsage;
  root["energy_traiff"] = _sp_sensor_event.energyTraiff;
  root["energy_bill"] = _sp_sensor_event.energyBill;
}

void SmartPodService::onConfigUpdated()
{
}

void SmartPodService::spinWheel()
{
  delay(1);
  Serial.print("\b\\");
  Serial.flush();
  delay(1);
  Serial.print("\b|");
  Serial.flush();
  delay(1);
  Serial.print("\b/");
  Serial.flush();
  delay(1);
  Serial.print("\b-");
  Serial.flush();
}