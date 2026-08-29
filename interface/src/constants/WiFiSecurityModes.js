export const WIFI_AUTH_OPEN = 0;
export const WIFI_AUTH_WEP = 1;
export const WIFI_AUTH_WPA_PSK = 2;
export const WIFI_AUTH_WPA2_PSK = 3;
export const WIFI_AUTH_WPA_WPA2_PSK = 4;
export const WIFI_AUTH_WPA2_ENTERPRISE = 5;

export const isNetworkOpen = selectedNetwork => selectedNetwork && selectedNetwork.encryption_type === WIFI_AUTH_OPEN;

export const networkSecurityMode = selectedNetwork => {
  switch (selectedNetwork.encryption_type){
    case WIFI_AUTH_WEP:
      return "WEP";
    case WIFI_AUTH_WPA_PSK:
      return "WPA";
    case WIFI_AUTH_WPA2_PSK:
      return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK:
      return "WPA/WPA2";
    case WIFI_AUTH_WPA2_ENTERPRISE:
      return "WPA2 Enterprise";
    case WIFI_AUTH_OPEN:
      return "None";
    default:
      return "Unknown";
  }
}
