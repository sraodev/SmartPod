#ifndef SMARTPODSERVICE_H
#define SMARTPODSERVICE_H

#include <Adafruit_Sensor.h>
#include <ESPAsyncWebServer.h>
#include <ACS712.h>

#define ACS712_SENSOR_VERSION 1  /**< Sensor Version */
#define SMART_POD_VOLTAGE 230.0  /**< The voltage in India is 230 volts */
#define SMART_POD_FREQUENCY 50.0 /**< 50 cycles (Hertz) per second */

/* Smart Pod Sensor event (36 bytes) */
/** struct sp_sensor_event_s is used to provide a single sensor event in a common format. */
typedef struct
{
	int32_t version;                          /**< must be sizeof(struct sensors_event_t) */
	int32_t timestamp;                        /**< time is in milliseconds */
	float power;							  /**< power in watts (W) */
	float energyUsage;						  /**< energy in Watts Hour (Wh) */
	float energyTraiff;					 	  /**< energy traiff in per kilowatt per hour. (INR) */
	float energyBill;						  /**< energy bill in Indian Rupee (INR) */
	sensors_event_t *sensor;
} sp_sensors_event_t;


/*!
*  @brief  Class that stores state and functions for interacting with
* SmartPod.
*/
class SmartPodService : public Adafruit_Sensor
{

public:
	SmartPodService(uint8_t pin, ACS712_type type, int32_t currentSensorId = -1, int32_t voltageSensorId = -1);
	//SmartPodService(AsyncWebServer* server, FS* fs);
	~SmartPodService();

	void begin();
	void loop();

	bool getEvent(sp_sensors_event_t *sp_event);
	void getSensor(sensor_t *sensor);

	/*!
   	*  @brief  Class that stores state and functions about Voltage
   	*/
	class Voltage : public Adafruit_Sensor
	{

	public:
		Voltage(SmartPodService *parent, int32_t id);
		bool getEvent(sensors_event_t *event);
		void getSensor(sensor_t *sensor);

	private:
		SmartPodService *_parent;
		int32_t _id;
	};

	/*!
   	*  @brief  Class that stores state and functions about Humidity
   	*/
	class Current : public Adafruit_Sensor
	{

	public:
		Current(SmartPodService *parent, int32_t id);
		bool getEvent(sensors_event_t *event);
		void getSensor(sensor_t *sensor);

	private:
		SmartPodService *_parent;
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
	sensor_t _sp_sensor;
	sp_sensors_event_t _sp_sensor_event;
	Voltage _voltage;
	Current _current;

	void setName(sensor_t *sensor);
	void setMinDelay(sensor_t *sensor);
};

#endif /* SMARTPODSERVICE_H */
