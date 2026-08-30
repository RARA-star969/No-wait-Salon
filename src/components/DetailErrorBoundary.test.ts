import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DetailErrorBoundary } from './DetailErrorBoundary';

/**
 * Regression coverage for the listing -> detail transition's safety net
 * (see CustomerApp.tsx: PremiumBusinessCard onClick -> setSelectedSalon ->
 * setScreen('salon') -> DetailErrorBoundary wrapping GymDetailPage /
 * SalonDetailPage). A render exception thrown by either detail page must
 * never produce a blank screen with no way back to Home.
 *
 * React's legacy server renderer (renderToStaticMarkup) does not invoke
 * class-component error-boundary catching during SSR — that only happens on
 * a real client render — so this exercises the boundary's actual
 * getDerivedStateFromError/render contract directly instead of relying on
 * a throwing child to be caught mid-render.
 */

test('getDerivedStateFromError captures the thrown error', () => {
  const error = new Error('simulated detail render crash');
  const derived = DetailErrorBoundary.getDerivedStateFromError(error);
  assert.equal(derived.error, error);
});

test('once an error is caught, render() shows a recovery screen with the real error and a way back to Home', () => {
  const boundary = new DetailErrorBoundary({
    businessName: 'Sharpcut Studio',
    onBackToHome: () => {},
    children: React.createElement('div', null, 'never shown'),
  });
  boundary.state = { error: new Error('simulated detail render crash') };

  const html = renderToStaticMarkup(boundary.render() as React.ReactElement);
  assert.match(html, /Something went wrong/);
  assert.match(html, /Back to Home/);
  assert.match(html, /Sharpcut Studio/, 'names the business that failed to open');
  assert.match(html, /simulated detail render crash/, 'the real error message must be exposed, not swallowed');
  assert.doesNotMatch(html, /never shown/, 'the crashed child must not render alongside the fallback');
});

test('with no error, render() passes the detail page through unmodified', () => {
  const boundary = new DetailErrorBoundary({
    businessName: 'Sharpcut Studio',
    onBackToHome: () => {},
    children: React.createElement('div', null, 'Sharpcut Studio detail content'),
  });
  boundary.state = { error: null };

  const html = renderToStaticMarkup(boundary.render() as React.ReactElement);
  assert.match(html, /Sharpcut Studio detail content/);
  assert.doesNotMatch(html, /Something went wrong/);
});
