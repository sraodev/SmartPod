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
  describe('tariff charge golden cases', () => {
    // Rounding contract: round energy and time independently to the nearest
    // minor unit, with non-negative half ties rounding up. Then calculate tax
    // from the rounded subtotal and round tax using the same rule.

    test('keeps a started session free when every tariff rate is zero', () => {
      expect(
        calculateCharge({
          energyMilliWh: 987654321,
          activeSeconds: 3599,
          tariff: {
            fixedMinor: 0,
            energyPerKwhMinor: 0,
            timePerMinuteMinor: 0,
            taxBasisPoints: 0
          },
          sessionStarted: true
        })
      ).toEqual({
        fixedMinor: 0,
        energyMinor: 0,
        timeMinor: 0,
        taxMinor: 0,
        totalMinor: 0
      });
    });

    test.each([
      [
        'just below the half-minor tie',
        499999,
        {
          fixedMinor: 0,
          energyMinor: 0,
          timeMinor: 0,
          taxMinor: 0,
          totalMinor: 0
        }
      ],
      [
        'at the half-minor tie',
        500000,
        {
          fixedMinor: 0,
          energyMinor: 1,
          timeMinor: 0,
          taxMinor: 0,
          totalMinor: 1
        }
      ],
      [
        'just above the half-minor tie',
        500001,
        {
          fixedMinor: 0,
          energyMinor: 1,
          timeMinor: 0,
          taxMinor: 0,
          totalMinor: 1
        }
      ]
    ])('rounds energy %s', (_label, energyMilliWh, expected) => {
      expect(
        calculateCharge({
          energyMilliWh,
          activeSeconds: 0,
          tariff: {
            fixedMinor: 0,
            energyPerKwhMinor: 1,
            timePerMinuteMinor: 0,
            taxBasisPoints: 0
          },
          sessionStarted: true
        })
      ).toEqual(expected);
    });

    test.each([
      [
        'just below one kWh',
        999999,
        {
          fixedMinor: 0,
          energyMinor: 999999,
          timeMinor: 0,
          taxMinor: 0,
          totalMinor: 999999
        }
      ],
      [
        'at one kWh',
        1000000,
        {
          fixedMinor: 0,
          energyMinor: 1000000,
          timeMinor: 0,
          taxMinor: 0,
          totalMinor: 1000000
        }
      ],
      [
        'just above one kWh',
        1000001,
        {
          fixedMinor: 0,
          energyMinor: 1000001,
          timeMinor: 0,
          taxMinor: 0,
          totalMinor: 1000001
        }
      ]
    ])('preserves the exact kWh boundary %s', (_label, energyMilliWh, expected) => {
      expect(
        calculateCharge({
          energyMilliWh,
          activeSeconds: 0,
          tariff: {
            fixedMinor: 0,
            energyPerKwhMinor: 1000000,
            timePerMinuteMinor: 0,
            taxBasisPoints: 0
          },
          sessionStarted: true
        })
      ).toEqual(expected);
    });

    test.each([
      [
        'just below the half-minor tie',
        2,
        {
          fixedMinor: 0,
          energyMinor: 0,
          timeMinor: 0,
          taxMinor: 0,
          totalMinor: 0
        }
      ],
      [
        'at the half-minor tie',
        3,
        {
          fixedMinor: 0,
          energyMinor: 0,
          timeMinor: 1,
          taxMinor: 0,
          totalMinor: 1
        }
      ],
      [
        'just above the half-minor tie',
        4,
        {
          fixedMinor: 0,
          energyMinor: 0,
          timeMinor: 1,
          taxMinor: 0,
          totalMinor: 1
        }
      ]
    ])('rounds a sub-minute session %s', (_label, activeSeconds, expected) => {
      expect(
        calculateCharge({
          energyMilliWh: 0,
          activeSeconds,
          tariff: {
            fixedMinor: 0,
            energyPerKwhMinor: 0,
            timePerMinuteMinor: 10,
            taxBasisPoints: 0
          },
          sessionStarted: true
        })
      ).toEqual(expected);
    });

    test.each([
      [
        'just below the half-minor tie',
        1,
        {
          fixedMinor: 1,
          energyMinor: 0,
          timeMinor: 0,
          taxMinor: 0,
          totalMinor: 1
        }
      ],
      [
        'at the half-minor tie',
        2,
        {
          fixedMinor: 2,
          energyMinor: 0,
          timeMinor: 0,
          taxMinor: 1,
          totalMinor: 3
        }
      ],
      [
        'just above the half-minor tie',
        3,
        {
          fixedMinor: 3,
          energyMinor: 0,
          timeMinor: 0,
          taxMinor: 1,
          totalMinor: 4
        }
      ]
    ])('rounds fractional tax %s', (_label, fixedMinor, expected) => {
      expect(
        calculateCharge({
          energyMilliWh: 0,
          activeSeconds: 0,
          tariff: {
            fixedMinor,
            energyPerKwhMinor: 0,
            timePerMinuteMinor: 0,
            taxBasisPoints: 2500
          },
          sessionStarted: true
        })
      ).toEqual(expected);
    });
        test('calculates tax from the rounded component subtotal', () => {
      expect(
        calculateCharge({
          energyMilliWh: 500000,
          activeSeconds: 3,
          tariff: {
            fixedMinor: 0,
            energyPerKwhMinor: 1,
            timePerMinuteMinor: 10,
            taxBasisPoints: 2500
          },
          sessionStarted: true
        })
      ).toEqual({
        fixedMinor: 0,
        energyMinor: 1,
        timeMinor: 1,
        taxMinor: 1,
        totalMinor: 3
      });
    });

    test('calculates a large valid charge within safe-integer arithmetic', () => {
      const energyMilliWh = 4000000000;
      const activeSeconds = 100000000;
      const tariff = {
        fixedMinor: 1000000,
        energyPerKwhMinor: 2000000,
        timePerMinuteMinor: 3000000,
        taxBasisPoints: 1000
      };

      expect(
        Number.isSafeInteger(
          energyMilliWh * tariff.energyPerKwhMinor
        )
      ).toBe(true);
      expect(
        Number.isSafeInteger(
          activeSeconds * tariff.timePerMinuteMinor
        )
      ).toBe(true);
      expect(
        Number.isSafeInteger(5008001000000 * tariff.taxBasisPoints)
      ).toBe(true);

      const breakdown = calculateCharge({
        energyMilliWh,
        activeSeconds,
        tariff,
        sessionStarted: true
      });

      expect(breakdown).toEqual({
        fixedMinor: 1000000,
        energyMinor: 8000000000,
        timeMinor: 5000000000000,
        taxMinor: 500800100000,
        totalMinor: 5508801100000
      });
      expect(Object.values(breakdown).every(Number.isSafeInteger)).toBe(true);
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
