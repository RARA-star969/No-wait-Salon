import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Mirrors the edge detection the public web page uses to raise the
 * "It's your turn" popup: fire only on the transition INTO 'Called', never on
 * repeated snapshots of the same status (SSE re-sends the full state on every
 * change, so the same status arrives many times).
 */
function turnAlerts(statuses: Array<string | null>): number {
  let previous: string | null = null;
  let fired = 0;
  for (const status of statuses) {
    if (previous && previous !== 'Called' && status === 'Called') fired += 1;
    previous = status;
  }
  return fired;
}

/** Position and people-ahead as rendered on the live status card. */
function aheadOf(queue: Array<{ id: string; status: string; createdAt: number }>, entryId: string): number {
  const entry = queue.find((item) => item.id === entryId)!;
  return queue.filter(
    (item) => item.id !== entry.id && ['Waiting', 'Called', 'Serving'].includes(item.status) && item.createdAt < entry.createdAt,
  ).length;
}

test('turn popup fires exactly once when staff calls the customer', () => {
  assert.equal(turnAlerts(['Waiting', 'Waiting', 'Called']), 1);
});

test('repeated SSE snapshots of the same status do not re-fire the popup', () => {
  assert.equal(turnAlerts(['Waiting', 'Called', 'Called', 'Called']), 1);
});

test('joining straight into Called does not fire before a baseline exists', () => {
  // The first snapshot only establishes the baseline; it must not alert.
  assert.equal(turnAlerts(['Called']), 0);
});

test('the full staff lifecycle drives one alert then progresses', () => {
  const lifecycle = ['Waiting', 'Called', 'Serving', 'Completed'];
  assert.equal(turnAlerts(lifecycle), 1);
  assert.equal(lifecycle.at(-1), 'Completed');
});

test('people ahead shrinks as staff work the queue', () => {
  const queue = [
    { id: 'a', status: 'Waiting', createdAt: 1 },
    { id: 'b', status: 'Waiting', createdAt: 2 },
    { id: 'me', status: 'Waiting', createdAt: 3 },
  ];
  assert.equal(aheadOf(queue, 'me'), 2);

  queue[0].status = 'Completed';
  assert.equal(aheadOf(queue, 'me'), 1, 'completed entries stop counting');

  queue[1].status = 'Serving';
  assert.equal(aheadOf(queue, 'me'), 1, 'in-service entries still count');
});

test('the customer is position ahead+1 and reaches position 1 when next', () => {
  const queue = [
    { id: 'a', status: 'Completed', createdAt: 1 },
    { id: 'me', status: 'Waiting', createdAt: 2 },
  ];
  assert.equal(aheadOf(queue, 'me') + 1, 1);
});
