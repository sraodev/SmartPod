import {
  WIFI_AUTH_OPEN,
  WIFI_AUTH_WEP,
  WIFI_AUTH_WPA_PSK,
  WIFI_AUTH_WPA2_PSK,
  WIFI_AUTH_WPA_WPA2_PSK,
  WIFI_AUTH_WPA2_ENTERPRISE,
  isNetworkOpen,
  networkSecurityMode
} from './WiFiSecurityModes';

describe('Wi-Fi security modes', () => {
  test.each([
    [WIFI_AUTH_OPEN, 'None'],
    [WIFI_AUTH_WEP, 'WEP'],
    [WIFI_AUTH_WPA_PSK, 'WPA'],
    [WIFI_AUTH_WPA2_PSK, 'WPA2'],
    [WIFI_AUTH_WPA_WPA2_PSK, 'WPA/WPA2'],
    [WIFI_AUTH_WPA2_ENTERPRISE, 'WPA2 Enterprise']
  ])('maps mode %i to %s', (encryption_type, label) => {
    expect(networkSecurityMode({ encryption_type })).toBe(label);
  });

  test('identifies only an explicit open network as open', () => {
    expect(isNetworkOpen({ encryption_type: WIFI_AUTH_OPEN })).toBe(true);
    expect(isNetworkOpen({ encryption_type: WIFI_AUTH_WPA2_PSK })).toBe(false);
    expect(isNetworkOpen(undefined)).toBeFalsy();
  });
});
