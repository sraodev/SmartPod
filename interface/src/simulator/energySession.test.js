import {
  DEFAULT_TARIFF,
  calculateCharge,
  formatDuration,
  simulateTick
} from './energySession';

describe('energy session simulator', () => {
  test('keeps charge at zero before a session starts', () => {
    expect(calculateCharge({
      energyWh: 500,
      activeSeconds: 120,
      tariff: DEFAULT_TARIFF,
      sessionStarted: false
    })).toEqual({
      fixedMinor: 0,
      energyMinor: 0,
      timeMinor: 0,
      taxMinor: 0,
      totalMinor: 0
    });
  });

  test('calculates a reproducible tariff breakdown in minor units', () => {
    expect(calculateCharge({
      energyWh: 500,
      activeSeconds: 120,
      tariff: DEFAULT_TARIFF,
      sessionStarted: true
    })).toEqual({
      fixedMinor: 500,
      energyMinor: 600,
      timeMinor: 40,
      taxMinor: 205,
      totalMinor: 1345
    });
  });

  test('advances power and cumulative energy deterministically', () => {
    const first = simulateTick({
      elapsedSeconds: 0,
      energyWh: 0,
      currentLimitA: 16,
      voltageV: 230
    });
    const repeated = simulateTick({
      elapsedSeconds: 0,
      energyWh: 0,
      currentLimitA: 16,
      voltageV: 230
    });

    expect(first).toEqual(repeated);
    expect(first.currentA).toBeGreaterThan(0);
    expect(first.powerW).toBeGreaterThan(0);
    expect(first.energyWh).toBeGreaterThan(0);
  });

  test('formats elapsed time as hours, minutes, and seconds', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
    expect(formatDuration(-20)).toBe('00:00:00');
  });
});
