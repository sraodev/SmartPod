import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';

import SmartPodDemo from './SmartPodDemo';

const findButton = (container, label) => Array.from(container.querySelectorAll('button'))
  .find(button => button.textContent.includes(label));

// The component confirms output 650 ms after a start request.
const AFTER_START_TRANSITION_MS = 700;

const CONTROLS = 'button, input:not([type="hidden"]), select, textarea, a[href], [role="slider"]';

const controls = container => Array.from(container.querySelectorAll(CONTROLS));

// Enough of the accessible-name algorithm to catch a control that has no name
// or whose name paraphrases away the text on screen.
const accessibleName = element => {
  const label = element.getAttribute('aria-label');
  if (label) return label.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const referenced = labelledBy.split(' ')
      .map(id => (document.getElementById(id) || {}).textContent || '')
      .join(' ')
      .trim();
    if (referenced) return referenced;
  }

  if (element.id) {
    const associated = document.querySelector(`label[for="${element.id}"]`);
    if (associated) return associated.textContent.trim();
  }

  const wrapping = element.closest('label');
  if (wrapping) return wrapping.textContent.trim();

  return element.textContent.trim();
};

const identify = element => [
  element.tagName.toLowerCase(),
  element.type ? `[${element.type}]` : '',
  element.id ? `#${element.id}` : ''
].join('');

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
  test.each([
    ['button', 'Start session'],
    ['button', 'Stop safely'],
    ['button', 'Inject thermal fault'],
    ['button', 'Reset'],
    ['switch', 'Cloud connection available'],
    ['slider', 'Simulated current limit'],
    ['field', 'Nominal voltage'],
    ['field', 'Energy ₹/kWh'],
    ['field', 'Session fee ₹'],
    ['field', 'Time ₹/min'],
    ['field', 'Tax %']
  ])('names the %s control "%s" exactly as it reads on screen', (_kind, name) => {
    expect(controls(container).map(accessibleName)).toContain(name);
  });

  // The name a voice-control user speaks is the text they can see, so a label
  // that paraphrases the visible text locks them out (WCAG 2.5.3 Label in
  // Name). An unnamed control locks out screen readers outright.
  test('names every control, and never with text that hides what is on screen', () => {
    const offenders = controls(container)
      .map(control => ({
        control: identify(control),
        name: accessibleName(control),
        visible: control.textContent.trim()
      }))
      .filter(({ name, visible }) => !name || (visible && !name.includes(visible)))
      .map(({ control, name, visible }) => `${control}: visible "${visible}" vs name "${name}"`);

    expect(offenders).toEqual([]);
  });

  test('exposes session state through a live region and enables stop and fault once started', () => {
    const status = container.querySelector('[role="status"]');
    expect(status).toBeTruthy();

    const start = findButton(container, 'Start session');
    const stop = findButton(container, 'Stop safely');
    const fault = findButton(container, 'Inject thermal fault');

    expect(stop.disabled).toBe(true);
    expect(fault.disabled).toBe(true);

    act(() => {
      start.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      jest.advanceTimersByTime(AFTER_START_TRANSITION_MS);
    });

    expect(status.textContent).toContain('Contactor feedback: closed');
    expect(stop.disabled).toBe(false);
    expect(fault.disabled).toBe(false);
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
