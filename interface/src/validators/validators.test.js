import isHostname from './isHostname';
import isIP from './isIP';
import optional from './optional';
import or from './or';

describe('network validators', () => {
  test('accepts valid IPv4 addresses and rejects invalid octets', () => {
    expect(isIP('192.168.1.10')).toBe(true);
    expect(isIP('255.255.255.255')).toBe(true);
    expect(isIP('256.1.1.1')).toBe(false);
    expect(isIP('192.168.1')).toBe(false);
  });

  test('accepts device hostnames and rejects invalid labels', () => {
    expect(isHostname('smartpod')).toBe(true);
    expect(isHostname('garage.smartpod')).toBe(true);
    expect(isHostname('-smartpod')).toBe(false);
    expect(isHostname('smart_pod')).toBe(false);
  });

  test('composes optional and alternative validators', () => {
    expect(optional(isIP)('')).toBe(true);
    expect(optional(isIP)('10.0.0.4')).toBe(true);
    expect(or(isIP, isHostname)('smartpod')).toBe(true);
    expect(or(isIP, isHostname)('not valid!')).toBe(false);
  });
});
