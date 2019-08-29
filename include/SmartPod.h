#ifndef SMARTPOD_H
#define SMARTPOD_H

#include <Adafruit_Sensor.h>
#include <ACS712.h>

#define ACS712_SENSOR_VERSION 1 /**< Sensor Version */
#define SMART_CHARGE_STATION_VOLTAGE 230.0 /**< The voltage in India is 230 volts */
#define SMART_CHARGE_STATION_FREQUENCY 50.0 /**< 50 cycles (Hertz) per second */

/*!
*  @brief  Class that stores state and functions for interacting with
* SmartPod.
*/
class SmartPod {

public:
	SmartPod(uint8_t pin, ACS712_type type, int32_t currentSensorId = -1, int32_t voltageSensorId = -1);
	~SmartPod();
	
	void begin();

  	/*!
   	*  @brief  Class that stores state and functions about Voltage
   	*/
  	class Voltage : public Adafruit_Sensor {
  	
	public:
    	Voltage(SmartPod *parent, int32_t id);
    	bool getEvent(sensors_event_t *event);
    	void getSensor(sensor_t *sensor);

  	private:
    	SmartPod *_parent;
    	int32_t _id;
  	};

  	/*!
   	*  @brief  Class that stores state and functions about Humidity
   	*/
  	class Current : public Adafruit_Sensor {
  	
	public:
    	Current(SmartPod *parent, int32_t id);
    	bool getEvent(sensors_event_t *event);
    	void getSensor(sensor_t *sensor);

  	private:
    	SmartPod *_parent;
    	int32_t _id;
  	};

	/*!
   	*  @brief  Returns voltage stored in _voltage
   	*  @return Voltage value
   	*/
  	Voltage voltage() { return _voltage; }

	/*!
   	*  @brief  Returns humidity stored in _humidity
   	*  @return Humidity value
   	*/
  	Current current() { return _current; }
	
	
	private:
  		ACS712 _acs712;
  		ACS712_type _type;
  		Voltage _voltage;
  		Current _current;

		void setName(sensor_t* sensor);
		void setMinDelay(sensor_t* sensor);

};

#endif /* SMARTPOD_H */
