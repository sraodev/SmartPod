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
  Serial.println("SmartPodService::begin...!");
  //SettingsService::begin();
  readFromFS();
  //_acs712 = new ACS712(_sensor_type, _sensor_pin);
  _acs712 = new ACS712(_sensor_type, A0);

  // calibrate() method calibrates zero point of sensor,
  // It is not necessary, but may positively affect the accuracy
  // Ensure that no current flows through the sensor at this moment
  // If you are not sure that the current through the sensor will not leak during calibration - comment out this method
  Serial.println("Calibrating... Ensure that no current flows through the sensor at this moment");
  //_acs712->calibrate();
  Serial.println("Done!");
  getSmartPodSensor(&_sp_sensor);
}

void SmartPodService::loop()
{
  getSmartPodEvent(&_sp_sensor_event);
}

/*!
 *  @brief  Reads the sensor and returns the data as a sp_sensors_event_t
 *  @param  event
 *  @return always returns true
 */
bool SmartPodService::getSmartPodEvent(sp_sensors_event_t *sp_event)
{
  // Clear event definition.
  memset(sp_event, 0, sizeof(sp_sensors_event_t));
  // Populate sensor reading values.
  getEvent(&(sp_event->sensor));

  sp_event->version = sizeof(sp_sensors_event_t);
  sp_event->timestamp = millis();
  sp_event->power = sp_event->sensor.voltage * sp_event->sensor.current;
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
  Serial.println("SmartPodService::setName ...!");
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
  Serial.println("SmartPodService::setMinDelay ...!");
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
  //memset(event, 0, sizeof(sensors_event_t));
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
  Serial.println("SmartPodService::getSensor ...!");
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
  Serial.print("SmartPodService::getVoltage() :");
  Serial.println(_sp_sensor_event.sensor.voltage);
  return _sp_sensor_event.sensor.voltage;
}
void SmartPodService::setVoltage(float voltage)
{
  Serial.print("SmartPodService::setVoltage() :");
  Serial.println(voltage);
  _sp_sensor_event.sensor.voltage = voltage;
}

float SmartPodService::getCurrent()
{
  Serial.print("SmartPodService::getCurrent() :");
  Serial.println(_sp_sensor_event.sensor.current);
  return _sp_sensor_event.sensor.current;
}

float SmartPodService::getPower()
{
  Serial.print("SmartPodService::getPower() :");
  Serial.println(_sp_sensor_event.power);
  return _sp_sensor_event.power;
}

float SmartPodService::getEnergyUsage()
{
  Serial.print("SmartPodService::getEnergyUsage() :");
  Serial.println(_sp_sensor_event.energyUsage);
  return _sp_sensor_event.energyUsage;
}

float SmartPodService::getEnergyTraiff()
{
  Serial.print("SmartPodService::getEnergyTraiff() :");
  Serial.println(_sp_sensor_event.energyTraiff);
  return _sp_sensor_event.energyTraiff;
}

float SmartPodService::getEnergyBill()
{
  Serial.print("SmartPodService::getEnergyBill() :");
  Serial.println(_sp_sensor_event.energyBill);
  return _sp_sensor_event.energyBill;
}

void SmartPodService::readFromJsonObject(JsonObject &root)
{
  _sensor_type = ACS712Type[root["sensor_type"] | "ACS712_30A"];
  Serial.print("SmartPodService::_sensor_type() :");
  Serial.println(_sensor_type);

  _sensor_pin = root["sensor_pin"] | 1;
  Serial.print("SmartPodService::sensor_pin() :");
  Serial.println(_sensor_pin);

  _sensor_id = root["sensor_id"] | 1;
  Serial.print("SmartPodService::sensor_id() :");
  Serial.println(_sensor_id);

  _sp_sensor_event.frequency = root["frequency"] | DEFAULT_SMARTPOD_FREQUENCY;
  Serial.print("SmartPodService::frequency() :");
  Serial.println(_sp_sensor_event.frequency);

  _sp_sensor_event.sensor.voltage = root["voltage"] | DEFAULT_SMARTPOD_VOLTAGE;
  Serial.print("SmartPodService::voltage() :");
  Serial.println(_sp_sensor_event.sensor.voltage);

  _sp_sensor_event.sensor.current = root["current"] | 0.0;
  _sp_sensor_event.power = root["power"] | 0.0;
  _sp_sensor_event.energyUsage = root["energy_usage"] | 0.0;
  _sp_sensor_event.energyTraiff = root["energy_traiff"] | 0.0;
  _sp_sensor_event.energyBill = root["energy_bill"] | 0.0;
}

void SmartPodService::writeToJsonObject(JsonObject &root)
{
  // smartpod event value
  root["voltage"] = _sp_sensor_event.sensor.voltage;
  root["current"] = _sp_sensor_event.sensor.current;
  root["power"] = _sp_sensor_event.power;
  root["energy_usage"] = _sp_sensor_event.energyUsage;
  root["energy_traiff"] = _sp_sensor_event.energyTraiff;
  root["energy_bill"] = _sp_sensor_event.energyBill;
}

void SmartPodService::onConfigUpdated()
{
}