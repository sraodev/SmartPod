/*!
 *  @file SmartPod.cpp
 *
 *  Voltage & Current Unified Sensor Library
 *
 *  This is a library for AC series of low cost voltage/current sensors.
 */

#include <SmartPod.h>

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
SmartPod::SmartPod(uint8_t pin, ACS712_type type, int32_t currentSensorId, int32_t voltageSensorId):
_acs712(type, pin),
_type(type),
_voltage(this, voltageSensorId),
_current(this, currentSensorId)
{}

/*!
 *  @brief  Setup sensor (calls begin on It)
 */
void SmartPod::begin(){
    // calibrate() method calibrates zero point of sensor,
    // It is not necessary, but may positively affect the accuracy
    // Ensure that no current flows through the sensor at this moment
    // If you are not sure that the current through the sensor will not leak during calibration - comment out this method
    Serial.println("Calibrating... Ensure that no current flows through the sensor at this moment");
    _acs712.calibrate();
    Serial.println("Done!");
}

/*!
 *  @brief  Sets sensor name
 *  @param  sensor
 *          Sensor that will be set
 */
void SmartPod::setName(sensor_t* sensor) {
  switch(_type) {
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
  sensor->name[sizeof(sensor->name)- 1] = 0;
}


/*!
 *  @brief  Sets Minimum Delay Value
 *  @param  sensor
 *          Sensor that will be set
 */
void SmartPod::setMinDelay(sensor_t* sensor) {
  switch(_type) {
    case ACS712_05B:
      sensor->min_delay = 1000000L;  // 1 second (in microseconds)
      break;
    case ACS712_20A:
      sensor->min_delay = 2000000L;  // 2 second (in microseconds)
      break;
    case ACS712_30A:
      sensor->min_delay = 2000000L;  // 2 seconds (in microseconds)
      break;
    default:
      // Default to slowest sample rate in case of unknown type.
      sensor->min_delay = 2000000L;  // 2 seconds (in microseconds)
      break;
  }
}

/*!
 *  @brief  Instantiates a new SmartPod Voltage Class
 *  @param  parent
 *          Parent Sensor
 *  @param  id
 *          Sensor id
 */
SmartPod::Voltage::Voltage(SmartPod *parent, int32_t id):
    _parent(parent),
    _id(id)
{}

/*!
 *  @brief  Reads the sensor and returns the data as a sensors_event_t
 *  @param  event
 *  @return always returns true
 */
bool SmartPod::Voltage::getEvent(sensors_event_t* event) {
  // Clear event definition.
  memset(event, 0, sizeof(sensors_event_t));
  // Populate sensor reading values.
  event->version     = sizeof(sensors_event_t);
  event->sensor_id   = _id;
  event->type        = SENSOR_TYPE_VOLTAGE;
  event->timestamp   = millis();
  event->voltage = SMART_CHARGE_STATION_VOLTAGE;
  
  return true;
}


/*!
 *  @brief  Provides the sensor_t data for this sensor
 *  @param  sensor
 */
void SmartPod::Voltage::getSensor(sensor_t* sensor) {
  // Clear sensor definition.
  memset(sensor, 0, sizeof(sensor_t));
  // Set sensor name.
  _parent->setName(sensor);
  // Set version and ID
  sensor->version         = ACS712_SENSOR_VERSION;
  sensor->sensor_id       = _id;
  // Set type and characteristics.
  sensor->type            = SENSOR_TYPE_VOLTAGE;
  _parent->setMinDelay(sensor);
  // TODO: Voltage Need set values for sensor
  switch (_parent->_type) {
    case ACS712_05B:
      sensor->max_value   = 0.0F;
      sensor->min_value   = -0.0F;
      sensor->resolution  = 0.0F;
      break;
    case ACS712_20A:
      sensor->max_value   = 0.0F;
      sensor->min_value   = -0.0F;
      sensor->resolution  = 0.0F;
      break;
    case ACS712_30A:
      sensor->max_value   = 0.0F;
      sensor->min_value   = -0.0F;
      sensor->resolution  = 0.0F;
      break;
    default:
      // Unknown type, default to 0.
      sensor->max_value   = 0.0F;
      sensor->min_value   = 0.0F;
      sensor->resolution  = 0.0F;
      break;
  }
}

/*!
 *  @brief  Instantiates a new SmartPod Current Class
 *  @param  parent
 *          Parent Sensor
 *  @param  id
 *          Sensor id
 */
SmartPod::Current::Current(SmartPod* parent, int32_t id):
  _parent(parent),
  _id(id)
{}

/*!
 *  @brief  Reads the sensor and returns the data as a sensors_event_t
 *  @param  event
 *  @return always returns true
 */
bool SmartPod::Current::getEvent(sensors_event_t* event) {
  // Clear event definition.
  memset(event, 0, sizeof(sensors_event_t));
  // Populate sensor reading values.
  event->version           = sizeof(sensors_event_t);
  event->sensor_id         = _id;
  event->type              = SENSOR_TYPE_CURRENT;
  event->timestamp         = millis();
  event->current = _parent->_acs712.getCurrentAC(SMART_CHARGE_STATION_FREQUENCY);
  
  return true;
}

/*!
 *  @brief  Provides the sensor_t data for this sensor
 *  @param  sensor
 */
void SmartPod::Current::getSensor(sensor_t* sensor) {
  // Clear sensor definition.
  memset(sensor, 0, sizeof(sensor_t));
  // Set sensor name.
  _parent->setName(sensor);
  // Set version and ID
  sensor->version         = ACS712_SENSOR_VERSION;
  sensor->sensor_id       = _id;
  // Set type and characteristics.
  sensor->type            = SENSOR_TYPE_CURRENT;
  _parent->setMinDelay(sensor);
  switch (_parent->_type) {
    case ACS712_05B:
      sensor->max_value   = 5.0F;
      sensor->min_value   = -5.0F;
      sensor->resolution  = 0.054F;
      break;
    case ACS712_20A:
      sensor->max_value   = 20.0F;
      sensor->min_value   = -20.0F;
      sensor->resolution  = 0.017F;
      break;
    case ACS712_30A:
      sensor->max_value   = 30.0F;
      sensor->min_value   = -30.0F;
      sensor->resolution  = 0.007F;
      break;
    default:
      // Unknown type, default to 0.
      sensor->max_value   = 0.0F;
      sensor->min_value   = 0.0F;
      sensor->resolution  = 0.0F;
      break;
  }
}

SmartPod::~SmartPod()
{
}