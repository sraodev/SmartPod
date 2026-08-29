export const SESSION_STATE = {
  AVAILABLE: 'available',
  STARTING: 'starting',
  ACTIVE: 'active',
  STOPPING: 'stopping',
  COMPLETED: 'completed',
  FAULTED: 'faulted'
};

export const SESSION_EVENT = {
  START_REQUESTED: 'start_requested',
  OUTPUT_CONFIRMED: 'output_confirmed',
  STOP_REQUESTED: 'stop_requested',
  OUTPUT_OPENED: 'output_opened',
  FAULT_DETECTED: 'fault_detected',
  RESET: 'reset'
};

const TRANSITIONS = {
  [SESSION_STATE.AVAILABLE]: {
    [SESSION_EVENT.START_REQUESTED]: SESSION_STATE.STARTING
  },
  [SESSION_STATE.STARTING]: {
    [SESSION_EVENT.OUTPUT_CONFIRMED]: SESSION_STATE.ACTIVE,
    [SESSION_EVENT.FAULT_DETECTED]: SESSION_STATE.FAULTED
  },
  [SESSION_STATE.ACTIVE]: {
    [SESSION_EVENT.STOP_REQUESTED]: SESSION_STATE.STOPPING,
    [SESSION_EVENT.FAULT_DETECTED]: SESSION_STATE.FAULTED
  },
  [SESSION_STATE.STOPPING]: {
    [SESSION_EVENT.OUTPUT_OPENED]: SESSION_STATE.COMPLETED,
    [SESSION_EVENT.FAULT_DETECTED]: SESSION_STATE.FAULTED
  },
  [SESSION_STATE.COMPLETED]: {
    [SESSION_EVENT.START_REQUESTED]: SESSION_STATE.STARTING
  },
  [SESSION_STATE.FAULTED]: {}
};

export const transitionSession = (state, event) => {
  if (event === SESSION_EVENT.RESET) {
    return SESSION_STATE.AVAILABLE;
  }

  const nextState = TRANSITIONS[state] && TRANSITIONS[state][event];
  if (!nextState) {
    throw new Error(`Invalid session transition: ${state} -> ${event}`);
  }
  return nextState;
};

export const DEFAULT_TARIFF = {
  id: 'demo-inr-standard',
  version: 1,
  currency: 'INR',
  fixedMinor: 500,
  energyPerKwhMinor: 1200,
  timePerMinuteMinor: 20,
  taxBasisPoints: 1800
};

const nonNegativeInteger = value => Math.max(0, Math.round(Number(value) || 0));
const nonNegativeSeconds = value => Math.max(0, Math.floor(Number(value) || 0));

export const calculateCharge = ({
  energyMilliWh = 0,
  activeSeconds = 0,
  tariff = DEFAULT_TARIFF,
  sessionStarted = false
}) => {
  if (!sessionStarted) {
    return {
      fixedMinor: 0,
      energyMinor: 0,
      timeMinor: 0,
      taxMinor: 0,
      totalMinor: 0
    };
  }

  const fixedMinor = nonNegativeInteger(tariff.fixedMinor);
  const energyMinor = Math.round(
    nonNegativeInteger(energyMilliWh) * nonNegativeInteger(tariff.energyPerKwhMinor) / 1000000
  );
  const timeMinor = Math.round(
    nonNegativeSeconds(activeSeconds) * nonNegativeInteger(tariff.timePerMinuteMinor) / 60
  );
  const subtotalMinor = fixedMinor + energyMinor + timeMinor;
  const taxMinor = Math.round(
    subtotalMinor * nonNegativeInteger(tariff.taxBasisPoints) / 10000
  );

  return {
    fixedMinor,
    energyMinor,
    timeMinor,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor
  };
};

export const simulateTick = ({
  elapsedSeconds = 0,
  energyMilliWh = 0,
  currentLimitA = 16,
  voltageV = 230
}, stepSeconds = 1) => {
  const safeStep = nonNegativeSeconds(stepSeconds);
  const nextElapsedSeconds = nonNegativeSeconds(elapsedSeconds) + safeStep;
  const loadFactor = 0.82 + 0.08 * Math.sin(nextElapsedSeconds / 7);
  const currentA = nonNegativeInteger(currentLimitA) * loadFactor;
  const powerW = nonNegativeInteger(voltageV) * currentA * 0.96;
  const roundedPowerW = Math.round(powerW);

  return {
    elapsedSeconds: nextElapsedSeconds,
    currentA: Number(currentA.toFixed(2)),
    powerW: roundedPowerW,
    energyMilliWh: nonNegativeInteger(energyMilliWh) + Math.round(roundedPowerW * safeStep * 1000 / 3600)
  };
};

export const formatDuration = totalSeconds => {
  const safeSeconds = nonNegativeSeconds(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map(value => String(value).padStart(2, '0'))
    .join(':');
};
