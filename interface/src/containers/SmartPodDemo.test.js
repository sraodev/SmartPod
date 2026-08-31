import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';

import SmartPodDemo from './SmartPodDemo';

const findButton = (container, label) => Array.from(container.querySelectorAll('button'))
  .find(button => button.textContent.includes(label));

describe('SmartPodDemo', () => {
  let container;

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      render(
        <MemoryRouter>
          <SmartPodDemo />
        </MemoryRouter>,
        container
      );
    });
  });

  afterEach(() => {
    act(() => {
      unmountComponentAtNode(container);
    });
    container.remove();
    jest.useRealTimers();
  });

  test('renders public controls and the real-billing disclosure', () => {
    expect(container.textContent).toContain('Interactive simulator');
    expect(findButton(container, 'Start session')).toBeTruthy();
    expect(findButton(container, 'Inject thermal fault')).toBeTruthy();
    expect(container.textContent).toContain('Real billing requires a certified meter');
  });
    test('provides accessible names and keyboard focus targets for simulator controls', () => {
    const controlByName = name =>
      container.querySelector(`[aria-label="${name}"]`);

    const start = controlByName('Start simulated charging session');
    const stop = controlByName('Stop simulated charging session safely');
    const fault = controlByName('Inject simulated thermal safety fault');
    const network = controlByName('Network connection availability');
    const currentLimit = controlByName('Simulated current limit');
    const tariffControls = [
      controlByName('Energy tariff in rupees per kilowatt-hour'),
      controlByName('Session fee tariff in rupees'),
      controlByName('Time tariff in rupees per minute'),
      controlByName('Tariff tax percentage')
    ];

    [
      start,
      stop,
      fault,
      network,
      currentLimit,
      ...tariffControls
    ].forEach(control => {
      expect(control).toBeTruthy();
    });

    [start, network, currentLimit, ...tariffControls].forEach(control => {
      control.focus();
      expect(document.activeElement).toBe(control);
    });

    const status = container.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');

    act(() => {
      start.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      jest.advanceTimersByTime(700);
    });

    expect(stop.disabled).toBe(false);
    expect(fault.disabled).toBe(false);

    [stop, fault].forEach(control => {
      control.focus();
      expect(document.activeElement).toBe(control);
    });
  });

  test('starts, advances, and safely completes a simulated session', () => {
    act(() => {
      findButton(container, 'Start session').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      jest.advanceTimersByTime(1700);
    });

    expect(container.textContent).toContain('Delivering energy');
    expect(container.textContent).not.toContain('0.000 kWh');

    act(() => {
      findButton(container, 'Stop safely').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      jest.advanceTimersByTime(500);
    });

    expect(container.textContent).toContain('Session complete');
    expect(container.textContent).toContain('Contactor feedback: open');
  });

  test('opens the simulated contactor when a thermal fault is injected', () => {
    act(() => {
      findButton(container, 'Start session').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      jest.advanceTimersByTime(700);
    });
    act(() => {
      findButton(container, 'Inject thermal fault').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Faulted · output open');
    expect(container.textContent).toContain('Contactor feedback: open');
    expect(container.textContent).toContain('0.00 kW');
  });
});
