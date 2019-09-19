#ifndef SMARTPODSERVICE_H
#define SMARTPODSERVICE_H

#include <Adafruit_Sensor.h>
#include <ESPAsyncWebServer.h>
#include <SettingsService.h>
#include <ACS712.h>
#include <map>

#define SMARTPOD_SETTINGS_FILE "/config/spSettings.json"
#define SMARTPOD_SETTINGS_SERVICE_PATH "/rest/smartpodSettings"

#define ACS712_SENSOR_VERSION 1					/**< Sensor Version */
#define DEFAULT_SMARTPOD_SENSOR_TYPE ACS712_30A /**< The default sensor type ACS712_30A */
#define DEFAULT_SMARTPOD_SENSOR_PIN A0			/**< The default sensor pin A0 */
#define DEFAULT_SMARTPOD_SENSOR_ID 712			/**< The default sensor id 712 */
#define DEFAULT_SMARTPOD_VOLTAGE 230.0			/**< The voltage in India is 230 volts */
#define DEFAULT_SMARTPOD_FREQUENCY 50.0			/**< 50 cycles (Hertz) per second */
#define DEFAULT_SMARTPOD_CURRENT 0.0			/**< Default current  zero amps */
#define DEFAULT_SMARTPOD_POWER 0.0				/**< Default power  zero watts */
#define DEFAULT_SMARTPOD_ENERGY_USAGE 0.0		/**< Default energy usage  zero kilowatts */
#define DEFAULT_SMARTPOD_ENGERY_TRAIFF 0.0		/**< Default energy traiff  zero INR */
#define DEFAULT_SMARTPOD_ENGERY_BILL 0.0		/**< Default energy bill  zero INR */

/* Smart Pod Sensor event ( bytes) */
/** struct sp_sensor_event_s is used to provide a single sensor event in a common format. */
typedef struct
{
	int32_t version;	/**< must be sizeof(struct sensors_event_t) */
	int32_t timestamp;  /**< time is in milliseconds */
	float voltage;		/**< voltage in volts (V) */
	float frequency;	/**< 50 cycles (Hertz) per second */
	float power;		/**< power in watts (W) */
	float energyUsage;  /**< energy in Watts Hour (Wh) */
	float energyTraiff; /**< energy traiff in per kilowatt per hour. (INR) */
	float energyBill;   /**< energy bill in Indian Rupee (INR) */
	sensors_event_t sensor;
} sp_sensors_event_t;

/*!
*  @brief  Class that stores state and functions for interacting with
* SmartPod.
*/
class SmartPodService : public Adafruit_Sensor, public AdminSettingsService
{

public:
	SmartPodService(AsyncWebServer *server, FS *fs, SecurityManager *securityManager);

	~SmartPodService();

	void begin();
	void loop();

	bool getSmartPodEvent(sp_sensors_event_t *sp_event);
	void getSmartPodSensor(sensor_t *sensor);

	bool getEvent(sensors_event_t *sp_event);
	void getSensor(sensor_t *sensor);

	float getVoltage();
	float getCurrent();
	float getPower();
	float getEnergyUsage();
	float getEnergyTraiff();
	float getEnergyBill();

protected:
	void readFromJsonObject(JsonObject &root);
	void writeToJsonObject(JsonObject &root);
	void onConfigUpdated();

private:
	ACS712 *_acs712;
	ACS712_type _sensor_type;
	uint8_t _sensor_pin;
	int32_t _sensor_id;
	float _voltage;
	sensor_t _sp_sensor;
	sp_sensors_event_t _sp_sensor_event;

	void setName(sensor_t *sensor);
	void setMinDelay(sensor_t *sensor);
	void spinWheel();
};

#endif /* SMARTPODSERVICE_H */
