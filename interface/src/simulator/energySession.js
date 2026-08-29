export const SESSION_STATE = {
  AVAILABLE: 'available',
  STARTING: 'starting',
  ACTIVE: 'active',
  STOPPING: 'stopping',
  COMPLETED: 'completed',
  FAULTED: 'faulted'
};

export const DEFAULT_TARIFF = {
  currency: 'INR',
  fixedMinor: 500,
  energyPerKwhMinor: 1200,
  timePerMinuteMinor: 20,
  taxBasisPoints: 1800
};

const nonNegative = value => Math.max(0, Number(value) || 0);

export const calculateCharge = ({
  energyWh = 0,
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

  const fixedMinor = Math.round(nonNegative(tariff.fixedMinor));
  const energyMinor = Math.round(
    nonNegative(energyWh) * nonNegative(tariff.energyPerKwhMinor) / 1000
  );
  const timeMinor = Math.round(
    nonNegative(activeSeconds) * nonNegative(tariff.timePerMinuteMinor) / 60
  );
  const subtotalMinor = fixedMinor + energyMinor + timeMinor;
  const taxMinor = Math.round(
    subtotalMinor * nonNegative(tariff.taxBasisPoints) / 10000
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
  energyWh = 0,
  currentLimitA = 16,
  voltageV = 230
}, stepSeconds = 1) => {
  const safeStep = nonNegative(stepSeconds);
  const nextElapsedSeconds = nonNegative(elapsedSeconds) + safeStep;
  const loadFactor = 0.82 + 0.08 * Math.sin(nextElapsedSeconds / 7);
  const currentA = nonNegative(currentLimitA) * loadFactor;
  const powerW = nonNegative(voltageV) * currentA * 0.96;

  return {
    elapsedSeconds: nextElapsedSeconds,
    currentA: Number(currentA.toFixed(2)),
    powerW: Math.round(powerW),
    energyWh: nonNegative(energyWh) + powerW * safeStep / 3600
  };
};

export const formatDuration = totalSeconds => {
  const safeSeconds = Math.floor(nonNegative(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map(value => String(value).padStart(2, '0'))
    .join(':');
};
