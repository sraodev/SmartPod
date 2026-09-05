/** @vitest-environment node */
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { calculateCharge, DEFAULT_TARIFF, SESSION_EVENT, SESSION_STATE, simulateTick, transitionSession } from './energySession';
import { projectSimulatorContract } from './gatewayContract';

const docs = path.resolve(__dirname, '../../../docs');
const fixtures = JSON.parse(fs.readFileSync(path.join(docs, 'fixtures/simulator-state-mappings.json'), 'utf8'));
const schemas = yaml.safeLoad(fs.readFileSync(path.join(docs, 'openapi-v2.yaml'), 'utf8')).components.schemas;

describe('simulator gateway contract projection', () => {
  test.each(fixtures)('maps $sessionState with $actualOutput feedback', fixture => {
    const result = projectSimulatorContract(fixture);
    expect(result).toEqual({
      port_state: fixture.port_state,
      session_state: fixture.session_state,
      actual_output: fixture.actualOutput,
      energy_wh: 0,
      energy_remainder_milliwh: 0
    });
    expect(schemas.Port.properties.state.enum).toContain(result.port_state);
    expect(schemas.Port.properties.actual_output.enum).toContain(result.actual_output);
    if (result.session_state !== null) {
      expect(schemas.Session.properties.state.enum).toContain(result.session_state);
    }
  });

  test('fixtures cover every simulator state; missing feedback is always unknown', () => {
    expect([...new Set(fixtures.map(fixture => fixture.sessionState))].sort())
      .toEqual(Object.values(SESSION_STATE).sort());
    Object.values(SESSION_STATE).forEach(sessionState => {
      expect(projectSimulatorContract({ sessionState }).actual_output).toBe('unknown');
    });
  });

  // Includes every accepted event edge, including RESET from all six states.
  const transitions = [
    ['available', 'start_requested', 'starting', 'energizing', 'energizing'],
    ['completed', 'start_requested', 'starting', 'energizing', 'energizing'],
    ['starting', 'output_confirmed', 'active', 'active', 'active'],
    ['active', 'stop_requested', 'stopping', 'stopping', 'stopping'],
    ['stopping', 'output_opened', 'completed', 'unavailable', 'completed'],
    ...['starting', 'active', 'stopping'].map(state => [state, 'fault_detected', 'faulted', 'faulted', 'failed']),
    ...Object.values(SESSION_STATE).map(state => [state, 'reset', 'available', 'unavailable', null])
  ];

  test.each(transitions)('%s + %s maps without inventing feedback', (state, event, next, port, session) => {
    const sessionState = transitionSession(state, event);
    expect(sessionState).toBe(next);
    expect(projectSimulatorContract({ sessionState })).toMatchObject({
      port_state: port, session_state: session, actual_output: 'unknown'
    });
  });

  test('transition fixtures enumerate the entire accepted state/event matrix', () => {
    Object.values(SESSION_STATE).forEach(state => {
      Object.values(SESSION_EVENT).forEach(event => {
        if (!transitions.some(([from, action]) => from === state && action === event)) {
          expect(() => transitionSession(state, event)).toThrow('Invalid session transition');
        }
      });
    });
  });

  // Truncate only the cumulative API projection, never each tick or pricing input.
  test.each([
    [0, 0, 0], [1, 0, 1], [999, 0, 999], [1000, 1, 0], [1001, 1, 1],
    [999999, 999, 999], [1000000, 1000, 0], [1000001, 1000, 1],
    [Number.MAX_SAFE_INTEGER, 9007199254740, 991]
  ])('projects %i milli-Wh to %i Wh and %i remainder', (energyMilliWh, wh, remainder) => {
    const result = projectSimulatorContract({ sessionState: 'active', energyMilliWh });
    expect(result.energy_wh).toBe(wh);
    expect(result.energy_remainder_milliwh).toBe(remainder);
    expect(result.energy_wh * 1000 + result.energy_remainder_milliwh).toBe(energyMilliWh);
  });

  test('repeated projections do not discard fractional Wh during accumulation', () => {
    let reading = { energyMilliWh: 0, elapsedSeconds: 0 };
    let unprojected = { ...reading };
    for (let tick = 0; tick < 60; tick += 1) {
      reading = simulateTick(reading);
      unprojected = simulateTick(unprojected);
      const before = { ...reading };
      const result = projectSimulatorContract({ ...reading, sessionState: 'active' });
      expect(reading).toEqual(before);
      expect(result.energy_wh * 1000 + result.energy_remainder_milliwh).toBe(reading.energyMilliWh);
    }
    expect(reading).toEqual(unprojected);
    expect(reading.energyMilliWh).toBeGreaterThan(0);
  });

  test('OpenAPI examples agree with projection and unchanged minor-unit pricing', () => {
    const input = Object.freeze({ sessionState: 'completed', energyMilliWh: 500417, activeSeconds: 120, sessionStarted: true, actualOutput: 'open' });
    const result = projectSimulatorContract(input);
    const port = schemas.Port.examples[0];
    const session = schemas.Session.examples[0];
    expect(port.state).toBe(result.port_state);
    expect(port.actual_output).toBe(result.actual_output);
    expect(port.measurement.energy_wh).toBe(result.energy_wh);
    expect(port.active_session_id).toBeNull();
    expect(session.state).toBe(result.session_state);
    expect(session.end_energy_wh).toBe(result.energy_wh);
    expect(session.port_id).toBe(port.id);
    expect(port.measurement.quality).toBe('estimated');
    expect(session.charge.estimated).toBe(true);
    expect(session.payment_state).toBe('not_required');
    expect(session.tariff).toEqual({
      id: DEFAULT_TARIFF.id, version: DEFAULT_TARIFF.version, currency: DEFAULT_TARIFF.currency,
      fixed_minor: DEFAULT_TARIFF.fixedMinor, energy_per_kwh_minor: DEFAULT_TARIFF.energyPerKwhMinor,
      time_per_minute_minor: DEFAULT_TARIFF.timePerMinuteMinor, idle_per_minute_minor: 0,
      tax_basis_points: DEFAULT_TARIFF.taxBasisPoints
    });

    // Existing rule: round each component half-up, then tax the rounded subtotal.
    const charge = calculateCharge(input);
    expect(charge).toEqual({ fixedMinor: 500, energyMinor: 601, timeMinor: 40, taxMinor: 205, totalMinor: 1346 });
    expect(session.charge).toEqual({
      currency: 'INR', fixed_minor: charge.fixedMinor, energy_minor: charge.energyMinor,
      time_minor: charge.timeMinor, idle_minor: 0, tax_minor: charge.taxMinor,
      total_minor: charge.totalMinor, estimated: true
    });
    Object.values(charge).forEach(value => expect(Number.isSafeInteger(value)).toBe(true));
    expect(calculateCharge({ ...input, energyMilliWh: result.energy_wh * 1000 }).totalMinor).toBe(1345);
    expect(calculateCharge({ ...input, sessionStarted: false }).totalMinor).toBe(0);
  });

  test.each([-1, 0.5, NaN, Infinity, '1000', null, Number.MAX_SAFE_INTEGER + 1])('rejects invalid energy %s', energyMilliWh => {
    expect(() => projectSimulatorContract({ sessionState: 'active', energyMilliWh })).toThrow('safe integer');
  });

  test.each(['authorizing', 'settled', 'toString', undefined])('rejects unsupported simulator state %s', sessionState => {
    expect(() => projectSimulatorContract({ sessionState })).toThrow('Unsupported simulator state');
  });

  test.each(['on', '', null, true])('rejects invalid feedback %s', actualOutput => {
    expect(() => projectSimulatorContract({ sessionState: 'active', actualOutput })).toThrow('Unsupported actual output');
  });
});
