import { SESSION_STATE } from './energySession';

const STATES = {
  [SESSION_STATE.AVAILABLE]: { port_state: 'available', session_state: null },
  [SESSION_STATE.STARTING]: { port_state: 'energizing', session_state: 'energizing' },
  [SESSION_STATE.ACTIVE]: { port_state: 'active', session_state: 'active' },
  [SESSION_STATE.STOPPING]: { port_state: 'stopping', session_state: 'stopping' },
  [SESSION_STATE.COMPLETED]: { port_state: 'available', session_state: 'completed' },
  [SESSION_STATE.FAULTED]: { port_state: 'faulted', session_state: 'failed' }
};

// Read-only contract fragments, not an API response or a hardware controller.
export const projectSimulatorContract = ({
  sessionState,
  energyMilliWh = 0,
  actualOutput = 'unknown'
}) => {
  if (!Object.prototype.hasOwnProperty.call(STATES, sessionState)) {
    throw new Error(`Unsupported simulator state: ${sessionState}`);
  }
  if (!Number.isSafeInteger(energyMilliWh) || energyMilliWh < 0) {
    throw new Error('energyMilliWh must be a non-negative safe integer');
  }
  if (!['open', 'closed', 'unknown'].includes(actualOutput)) {
    throw new Error(`Unsupported actual output: ${actualOutput}`);
  }

  const states = STATES[sessionState];
  return {
    ...states,
    // Completion/reset does not prove the output opened or the port is reusable.
    port_state: states.port_state === 'available' && actualOutput !== 'open'
      ? 'unavailable' : states.port_state,
    actual_output: actualOutput,
    energy_wh: Math.floor(energyMilliWh / 1000),
    energy_remainder_milliwh: energyMilliWh % 1000
  };
};
