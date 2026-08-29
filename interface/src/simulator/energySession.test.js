import {
  DEFAULT_TARIFF,
  SESSION_EVENT,
  SESSION_STATE,
  calculateCharge,
  formatDuration,
  simulateTick,
  transitionSession
} from './energySession';

describe('energy session simulator', () => {
  test('keeps charge at zero before a session starts', () => {
    expect(calculateCharge({
      energyMilliWh: 500000,
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
      energyMilliWh: 500000,
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
      energyMilliWh: 0,
      currentLimitA: 16,
      voltageV: 230
    });
    const repeated = simulateTick({
      elapsedSeconds: 0,
      energyMilliWh: 0,
      currentLimitA: 16,
      voltageV: 230
    });

    expect(first).toEqual(repeated);
    expect(first.currentA).toBeGreaterThan(0);
    expect(first.powerW).toBeGreaterThan(0);
    expect(Number.isInteger(first.energyMilliWh)).toBe(true);
    expect(first.energyMilliWh).toBeGreaterThan(0);
  });

  test('keeps meter accumulation in integer milli-Wh', () => {
    const first = simulateTick({ currentLimitA: 16, voltageV: 230 });
    const second = simulateTick({
      elapsedSeconds: first.elapsedSeconds,
      energyMilliWh: first.energyMilliWh,
      currentLimitA: 16,
      voltageV: 230
    });

    expect(Number.isInteger(second.energyMilliWh)).toBe(true);
    expect(second.energyMilliWh).toBeGreaterThan(first.energyMilliWh);
  });

  test('allows only declared session transitions', () => {
    expect(transitionSession(SESSION_STATE.AVAILABLE, SESSION_EVENT.START_REQUESTED)).toBe(SESSION_STATE.STARTING);
    expect(transitionSession(SESSION_STATE.STARTING, SESSION_EVENT.OUTPUT_CONFIRMED)).toBe(SESSION_STATE.ACTIVE);
    expect(transitionSession(SESSION_STATE.ACTIVE, SESSION_EVENT.STOP_REQUESTED)).toBe(SESSION_STATE.STOPPING);
    expect(transitionSession(SESSION_STATE.STOPPING, SESSION_EVENT.OUTPUT_OPENED)).toBe(SESSION_STATE.COMPLETED);
    expect(transitionSession(SESSION_STATE.FAULTED, SESSION_EVENT.RESET)).toBe(SESSION_STATE.AVAILABLE);
    expect(() => transitionSession(SESSION_STATE.AVAILABLE, SESSION_EVENT.OUTPUT_CONFIRMED)).toThrow('Invalid session transition');
  });

  test('formats elapsed time as hours, minutes, and seconds', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
    expect(formatDuration(1.9)).toBe('00:00:01');
    expect(formatDuration(-20)).toBe('00:00:00');
  });
});
