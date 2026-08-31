import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { withStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';
import Divider from '@material-ui/core/Divider';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Slider from '@material-ui/core/Slider';
import Switch from '@material-ui/core/Switch';
import TextField from '@material-ui/core/TextField';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import EvStationIcon from '@material-ui/icons/EvStation';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import RefreshIcon from '@material-ui/icons/Refresh';
import StopIcon from '@material-ui/icons/Stop';
import WarningIcon from '@material-ui/icons/Warning';

import {
  DEFAULT_TARIFF,
  SESSION_EVENT,
  SESSION_STATE,
  calculateCharge,
  formatDuration,
  simulateTick,
  transitionSession
} from '../simulator/energySession';

const styles = theme => ({
  root: {
    minHeight: '100vh',
    overflowX: 'hidden',
    background: 'radial-gradient(circle at 80% 0%, #263414 0, #111711 34%, #090d0c 72%)',
    color: '#f7f9f5'
  },
  appBar: {
    background: 'rgba(8, 12, 10, 0.9)',
    borderBottom: '1px solid rgba(164, 214, 74, 0.28)',
    boxShadow: 'none',
    backdropFilter: 'blur(12px)'
  },
  toolbar: {
    maxWidth: 1180,
    width: '100%',
    margin: '0 auto'
  },
  brandMark: {
    width: 36,
    height: 36,
    marginRight: theme.spacing(1.5),
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: '#a4d64a',
    color: '#11170d',
    fontWeight: 900
  },
  brand: {
    flexGrow: 1,
    fontWeight: 700
  },
  page: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: 1180,
    margin: '0 auto',
    padding: theme.spacing(6, 2, 8),
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(3, 1.5, 5)
    }
  },
  hero: {
    padding: theme.spacing(3, 0, 4)
  },
  eyebrow: {
    color: '#a4d64a',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 700,
    marginBottom: theme.spacing(1)
  },
  heroTitle: {
    fontWeight: 800,
    maxWidth: 780,
    lineHeight: 1.08,
    overflowWrap: 'anywhere',
    [theme.breakpoints.down('sm')]: {
      fontSize: '3rem'
    },
    [theme.breakpoints.down('xs')]: {
      fontSize: '2.5rem'
    }
  },
  heroCopy: {
    color: '#bbc5bc',
    maxWidth: 760,
    marginTop: theme.spacing(2)
  },
  statusRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2.5),
    '& .MuiChip-root': {
      maxWidth: '100%',
      height: 'auto'
    },
    '& .MuiChip-label': {
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      paddingTop: theme.spacing(0.75),
      paddingBottom: theme.spacing(0.75)
    }
  },
  panel: {
    minWidth: 0,
    height: '100%',
    padding: theme.spacing(2),
    background: 'rgba(22, 29, 24, 0.92)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 18
  },
  metricCard: {
    height: '100%',
    background: 'linear-gradient(145deg, rgba(36, 46, 38, 0.98), rgba(20, 27, 23, 0.98))',
    border: '1px solid rgba(164, 214, 74, 0.16)',
    borderRadius: 16
  },
  metricLabel: {
    color: '#9ba89d',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: '0.72rem',
    fontWeight: 700
  },
  metricValue: {
    marginTop: theme.spacing(0.75),
    fontWeight: 800,
    color: '#f8faf6',
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere'
  },
  metricDetail: {
    color: '#9ba89d',
    marginTop: theme.spacing(0.5)
  },
  sectionTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(0.5)
  },
  sectionCopy: {
    color: '#9ba89d',
    marginBottom: theme.spacing(2)
  },
  chart: {
    height: 190,
    marginTop: theme.spacing(2),
    padding: theme.spacing(1),
    borderRadius: 14,
    background: 'linear-gradient(180deg, rgba(164, 214, 74, 0.08), rgba(164, 214, 74, 0.01))',
    border: '1px solid rgba(164, 214, 74, 0.12)'
  },
  chartSvg: {
    width: '100%',
    height: '100%',
    overflow: 'visible'
  },
  sliderRow: {
    padding: theme.spacing(1, 0, 2)
  },
  sliderLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#dce4dc'
  },
  tariffGrid: {
    marginTop: theme.spacing(1)
  },
  textField: {
    minWidth: 0,
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255, 255, 255, 0.035)'
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#ffffff',
      borderWidth: 2
    }
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    [theme.breakpoints.down('xs')]: {
      '& > button': {
        width: '100%',
        justifyContent: 'flex-start'
      }
    }
  },
      actionButton: {
    '&:focus, &:focus-visible, &.Mui-focusVisible': {
      outline: '3px solid #ffffff',
      outlineOffset: 3
    }
  },
    slider: {
    '& .MuiSlider-thumb:focus, & .MuiSlider-thumb.Mui-focusVisible': {
      boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.9)'
    }
  },
    networkControl: {
    maxWidth: '100%',
    marginLeft: 0,
    marginRight: 0,
    '& .MuiFormControlLabel-label': {
      overflowWrap: 'anywhere'
    },
    '& .MuiSwitch-switchBase.Mui-focusVisible': {
      outline: '3px solid #ffffff',
      outlineOffset: 2,
      borderRadius: '50%'
    },
        '&:focus-within': {
      outline: '3px solid #ffffff',
      outlineOffset: 2,
      borderRadius: 24
    },
  },
  primaryAction: {
    fontWeight: 700
  },
  faultAction: {
    color: '#ffb74d',
    borderColor: 'rgba(255, 183, 77, 0.5)'
  },
  ledger: {
    marginTop: theme.spacing(2)
  },
  ledgerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minWidth: 0,
    gap: theme.spacing(2),
    padding: theme.spacing(1.1, 0),
    color: '#c7d0c8',
    overflowWrap: 'anywhere'
  },
  ledgerValue: {
    minWidth: 0,
    maxWidth: '60%',
    color: '#f8faf6',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
    overflowWrap: 'anywhere'
  },
  total: {
    color: '#a4d64a',
    fontWeight: 800
  },
  note: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: 12,
    background: 'rgba(255, 183, 77, 0.08)',
    color: '#ddc7a7',
    border: '1px solid rgba(255, 183, 77, 0.18)'
  }
});

const createInitialState = () => ({
  sessionState: SESSION_STATE.AVAILABLE,
  sessionStarted: false,
  currentLimitA: 16,
  voltageV: 230,
  currentA: 0,
  powerW: 0,
  energyMilliWh: 0,
  elapsedSeconds: 0,
  networkOnline: true,
  fault: null,
  samples: [0],
  draftTariff: { ...DEFAULT_TARIFF },
  activeTariff: { ...DEFAULT_TARIFF }
});

const statusLabels = {
  [SESSION_STATE.AVAILABLE]: 'Available',
  [SESSION_STATE.STARTING]: 'Safety checks',
  [SESSION_STATE.ACTIVE]: 'Delivering energy',
  [SESSION_STATE.STOPPING]: 'Stopping safely',
  [SESSION_STATE.COMPLETED]: 'Session complete',
  [SESSION_STATE.FAULTED]: 'Faulted · output open'
};

const money = (minor, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency,
  minimumFractionDigits: 2
}).format(minor / 100);

class SmartPodDemo extends Component {
  state = createInitialState();

  componentDidMount() {
    this.tickTimer = setInterval(this.tick, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.tickTimer);
    clearTimeout(this.transitionTimer);
  }

  tick = () => {
    this.setState(previous => {
      if (previous.sessionState !== SESSION_STATE.ACTIVE) {
        return null;
      }

      const reading = simulateTick(previous);
      return {
        ...reading,
        samples: [...previous.samples, reading.powerW].slice(-36)
      };
    });
  };

  startSession = () => {
    this.setState(previous => ({
      sessionState: transitionSession(previous.sessionState, SESSION_EVENT.START_REQUESTED),
      sessionStarted: true,
      currentA: 0,
      powerW: 0,
      energyMilliWh: 0,
      elapsedSeconds: 0,
      fault: null,
      samples: [0],
      activeTariff: { ...previous.draftTariff }
    }));
    clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(() => {
      this.setState(previous => previous.sessionState === SESSION_STATE.STARTING
        ? { sessionState: transitionSession(previous.sessionState, SESSION_EVENT.OUTPUT_CONFIRMED) }
        : null);
    }, 650);
  };

  stopSession = () => {
    this.setState(previous => ({
      sessionState: transitionSession(previous.sessionState, SESSION_EVENT.STOP_REQUESTED),
      currentA: 0,
      powerW: 0
    }));
    clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(() => {
      this.setState(previous => previous.sessionState === SESSION_STATE.STOPPING
        ? { sessionState: transitionSession(previous.sessionState, SESSION_EVENT.OUTPUT_OPENED) }
        : null);
    }, 450);
  };

  simulateFault = () => {
    clearTimeout(this.transitionTimer);
    this.setState(previous => ({
      sessionState: transitionSession(previous.sessionState, SESSION_EVENT.FAULT_DETECTED),
      currentA: 0,
      powerW: 0,
      fault: 'OVER_TEMPERATURE'
    }));
  };

  resetSimulator = () => {
    clearTimeout(this.transitionTimer);
    this.setState(previous => ({
      ...createInitialState(),
      sessionState: transitionSession(previous.sessionState, SESSION_EVENT.RESET),
      currentLimitA: previous.currentLimitA,
      voltageV: previous.voltageV,
      networkOnline: previous.networkOnline,
      draftTariff: { ...previous.draftTariff }
    }));
  };

  updateTariff = field => event => {
    const minorValue = Math.max(0, Math.round((Number(event.target.value) || 0) * 100));
    this.setState(previous => ({
      draftTariff: {
        ...previous.draftTariff,
        [field]: minorValue
      }
    }));
  };

  renderSparkline(samples) {
    const width = 600;
    const height = 160;
    const maxPower = Math.max(...samples, 1);
    const points = samples.map((sample, index) => {
      const x = samples.length === 1 ? 0 : index * width / (samples.length - 1);
      const y = height - sample / maxPower * (height - 18) - 9;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className={this.props.classes.chart} aria-label="Live simulated power graph">
        <svg className={this.props.classes.chartSvg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
          <defs>
            <linearGradient id="powerArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a4d64a" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#a4d64a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="151" x2="600" y2="151" stroke="rgba(255,255,255,0.12)" />
          <polygon points={`0,151 ${points} 600,151`} fill="url(#powerArea)" />
          <polyline points={points} fill="none" stroke="#a4d64a" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  }

  renderMetric(label, value, detail) {
    const { classes } = this.props;
    return (
      <Card className={classes.metricCard} elevation={0}>
        <CardContent>
          <Typography className={classes.metricLabel}>{label}</Typography>
          <Typography variant="h4" className={classes.metricValue}>{value}</Typography>
          <Typography variant="body2" className={classes.metricDetail}>{detail}</Typography>
        </CardContent>
      </Card>
    );
  }

  render() {
    const { classes } = this.props;
    const {
      sessionState,
      sessionStarted,
      currentLimitA,
      voltageV,
      currentA,
      powerW,
      energyMilliWh,
      elapsedSeconds,
      networkOnline,
      fault,
      samples,
      draftTariff,
      activeTariff
    } = this.state;
    const energyWh = energyMilliWh / 1000;
    const charge = calculateCharge({
      energyMilliWh,
      activeSeconds: elapsedSeconds,
      tariff: activeTariff,
      sessionStarted
    });
    const active = sessionState === SESSION_STATE.ACTIVE;
    const transitioning = sessionState === SESSION_STATE.STARTING || sessionState === SESSION_STATE.STOPPING;
    const canStart = networkOnline && (
      sessionState === SESSION_STATE.AVAILABLE || sessionState === SESSION_STATE.COMPLETED
    );
    const canFault = active || sessionState === SESSION_STATE.STARTING;
    const tariffLocked = active || transitioning;

    return (
      <div className={classes.root}>
        <AppBar position="sticky" className={classes.appBar}>
          <Toolbar className={classes.toolbar}>
            <div className={classes.brandMark}>SP</div>
            <Typography variant="h6" className={classes.brand}>SmartPod Lab</Typography>
            {!process.env.REACT_APP_DEMO_MODE && (
              <Button color="inherit" component={Link} to="/">Device sign in</Button>
            )}
          </Toolbar>
        </AppBar>

        <main className={classes.page}>
          <section className={classes.hero}>
            <Typography variant="overline" className={classes.eyebrow}>Interactive simulator · no hardware required</Typography>
            <Typography variant="h2" className={classes.heroTitle}>See every watt, session, and rupee before power turns on.</Typography>
            <Typography variant="h6" className={classes.heroCopy}>
              Explore SmartPod's proposed hardware-neutral session model. Start a simulated port, tune its current and tariff, disconnect the network, or inject a safety fault.
            </Typography>
            <div
  className={classes.statusRow}
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
              <Chip color={fault ? 'secondary' : 'primary'} label={statusLabels[sessionState]} icon={fault ? <WarningIcon /> : <EvStationIcon />} />
              <Chip variant="outlined" label={networkOnline ? 'Gateway online' : 'Offline ledger active'} icon={!networkOnline ? <CloudOffIcon /> : undefined} />
              <Chip variant="outlined" label={active ? 'Contactor feedback: closed' : 'Contactor feedback: open'} />
              <Chip variant="outlined" label={sessionStarted ? 'Payment sandbox: authorized' : 'Payment: not requested'} />
              <Chip variant="outlined" label={`Tariff snapshot: ${activeTariff.id} v${activeTariff.version}`} />
            </div>
          </section>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>{this.renderMetric('Live power', `${(powerW / 1000).toFixed(2)} kW`, `${currentA.toFixed(2)} A at ${voltageV} V`)}</Grid>
            <Grid item xs={12} sm={6} md={3}>{this.renderMetric('Session energy', `${(energyWh / 1000).toFixed(3)} kWh`, 'Monotonic simulated meter')}</Grid>
            <Grid item xs={12} sm={6} md={3}>{this.renderMetric('Running charge', money(charge.totalMinor, activeTariff.currency), sessionStarted ? 'Estimated until settlement' : 'Starts with authorization')}</Grid>
            <Grid item xs={12} sm={6} md={3}>{this.renderMetric('Elapsed', formatDuration(elapsedSeconds), networkOnline ? 'Synchronized' : 'Continuing offline')}</Grid>

            <Grid item xs={12} md={8}>
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h5" className={classes.sectionTitle}>Live energy session</Typography>
                <Typography variant="body2" className={classes.sectionCopy}>Deterministic one-second samples; no cloud, GPIO, or real payment is used.</Typography>
                {this.renderSparkline(samples)}

                <div className={classes.sliderRow}>
                  <div className={classes.sliderLabel}>
                    <Typography>Current limit</Typography>
                    <Typography color="primary"><strong>{currentLimitA} A</strong></Typography>
                  </div>
                  <Slider
                    className={classes.slider}
                    getAriaValueText={value => `${value} amperes`}
                    value={currentLimitA}
                    min={6}
                    max={32}
                    step={1}
                    marks={[{ value: 6, label: '6 A' }, { value: 16, label: '16 A' }, { value: 32, label: '32 A' }]}
                    onChange={(event, value) => this.setState({ currentLimitA: value })}
                    disabled={transitioning}
                    aria-label="Simulated current limit"
                  />
                </div>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      className={classes.textField}
                      label="Nominal voltage"
                      type="number"
                      variant="outlined"
                      fullWidth
                      value={voltageV}
                      inputProps={{ min: 100, max: 260, step: 1 }}
                      onChange={event => this.setState({ voltageV: Math.max(100, Number(event.target.value) || 230) })}
                      disabled={active || transitioning}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      className={classes.networkControl}
                      control={
  <Switch
    checked={networkOnline}
    onChange={event => this.setState({ networkOnline: event.target.checked })}
    color="primary"
    inputProps={{ 'aria-label': 'Network connection availability' }}
  />
}
                      label={networkOnline ? 'Cloud connection available' : 'Simulate network outage'}
                    />
                    {!networkOnline && (
                      <Typography variant="caption" display="block" className={classes.sectionCopy}>
                        An active bounded session continues offline; a new paid session waits for authorization.
                      </Typography>
                    )}
                  </Grid>
                </Grid>

               <div className={classes.actions}>
  <Button
    className={`${classes.primaryAction} ${classes.actionButton}`}
    variant="contained"
    color="primary"
    startIcon={<PlayArrowIcon />}
    onClick={this.startSession}
    disabled={!canStart}
    aria-label="Start simulated charging session"
  >
    Start session
  </Button>

  <Button
    className={classes.actionButton}
    variant="contained"
    color="secondary"
    startIcon={<StopIcon />}
    onClick={this.stopSession}
    disabled={!active}
    aria-label="Stop simulated charging session safely"
  >
    Stop safely
  </Button>

  <Button
    className={`${classes.faultAction} ${classes.actionButton}`}
    variant="outlined"
    startIcon={<WarningIcon />}
    onClick={this.simulateFault}
    disabled={!canFault}
    aria-label="Inject simulated thermal safety fault"
  >
    Inject thermal fault
  </Button>

  <Button
    className={classes.actionButton}
    variant="text"
    startIcon={<RefreshIcon />}
    onClick={this.resetSimulator}
    aria-label="Reset simulator"
  >
    Reset
  </Button>
</div>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h5" className={classes.sectionTitle}>Tariff and charge</Typography>
                <Typography variant="body2" className={classes.sectionCopy}>These fields configure the next session. Active and completed totals keep their original snapshot.</Typography>

                <Grid container spacing={2} className={classes.tariffGrid}>
  <Grid item xs={12} sm={6}>
    <TextField
      className={classes.textField}
      label="Energy ₹/kWh"
      type="number"
      variant="outlined"
      fullWidth
      value={(draftTariff.energyPerKwhMinor / 100).toFixed(2)}
      onChange={this.updateTariff('energyPerKwhMinor')}
      disabled={tariffLocked}
      inputProps={{
        min: 0,
        step: 0.5,
        'aria-label': 'Energy tariff in rupees per kilowatt-hour'
      }}
    />
  </Grid>

  <Grid item xs={12} sm={6}>
    <TextField
      className={classes.textField}
      label="Session fee ₹"
      type="number"
      variant="outlined"
      fullWidth
      value={(draftTariff.fixedMinor / 100).toFixed(2)}
      onChange={this.updateTariff('fixedMinor')}
      disabled={tariffLocked}
      inputProps={{
        min: 0,
        step: 1,
        'aria-label': 'Session fee tariff in rupees'
      }}
    />
  </Grid>

  <Grid item xs={12} sm={6}>
    <TextField
      className={classes.textField}
      label="Time ₹/min"
      type="number"
      variant="outlined"
      fullWidth
      value={(draftTariff.timePerMinuteMinor / 100).toFixed(2)}
      onChange={this.updateTariff('timePerMinuteMinor')}
      disabled={tariffLocked}
      inputProps={{
        min: 0,
        step: 0.1,
        'aria-label': 'Time tariff in rupees per minute'
      }}
    />
  </Grid>

  <Grid item xs={12} sm={6}>
    <TextField
      className={classes.textField}
      label="Tax %"
      type="number"
      variant="outlined"
      fullWidth
      value={(draftTariff.taxBasisPoints / 100).toFixed(2)}
      onChange={event =>
        this.setState(previous => ({
          draftTariff: {
            ...previous.draftTariff,
            taxBasisPoints: Math.max(
              0,
              Math.round((Number(event.target.value) || 0) * 100)
            )
          }
        }))
      }
      disabled={tariffLocked}
      inputProps={{
        min: 0,
        step: 1,
        'aria-label': 'Tariff tax percentage'
      }}
    />
  </Grid>
</Grid>

                <div className={classes.ledger}>
                  <Divider />
                  <div className={classes.ledgerRow}><span>Connection fee</span><span className={classes.ledgerValue}>{money(charge.fixedMinor)}</span></div>
                  <div className={classes.ledgerRow}><span>Energy</span><span className={classes.ledgerValue}>{money(charge.energyMinor)}</span></div>
                  <div className={classes.ledgerRow}><span>Active time</span><span className={classes.ledgerValue}>{money(charge.timeMinor)}</span></div>
                  <div className={classes.ledgerRow}><span>Tax</span><span className={classes.ledgerValue}>{money(charge.taxMinor)}</span></div>
                  <Divider />
                  <div className={classes.ledgerRow}><strong>Estimated total</strong><span className={`${classes.ledgerValue} ${classes.total}`}>{money(charge.totalMinor)}</span></div>
                </div>

                <Typography variant="body2" className={classes.note}>
                  This demo uses simulated measurements and sandbox payment state. Real billing requires a certified meter, jurisdiction-approved tariff handling, and server-verified payment events.
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </main>
      </div>
    );
  }
}

SmartPodDemo.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withStyles(styles)(SmartPodDemo);
