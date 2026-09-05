// Coverage for createSerialQueue — the shared serialization primitive
// postgresPersistence.ts's flushNow/insertMissingSalons/scheduleFlush/close
// all now go through, replacing the old `pending = pending.then(...)`
// chain that stayed permanently rejected (and so silently stopped running
// any future queued work) once a single queued Postgres write failed.
//
// These tests exercise the queue directly with controllable mock work
// functions rather than a live Postgres/Neon instance — the recovery
// property being verified is about promise-chain plumbing, not about SQL,
// so it can (and should) be proven deterministically without a database.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSerialQueue } from './postgresPersistence.ts';

test('a rejected queued operation does not prevent a later operation from running and succeeding', async () => {
  const queue = createSerialQueue();
  const order: string[] = [];

  const a = queue.enqueue(async () => { order.push('A'); return 'a-result'; });
  const b = queue.enqueue(async () => { order.push('B'); throw new Error('B failed'); });
  const c = queue.enqueue(async () => { order.push('C'); return 'c-result'; });

  // 1. first queued write succeeds
  await assert.doesNotReject(a);
  assert.equal(await a, 'a-result');

  // 5. failed operation's caller sees the rejection
  // 2. second queued write rejects
  await assert.rejects(b, /B failed/);

  // 3. third queued write still executes and succeeds
  await assert.doesNotReject(c);
  assert.equal(await c, 'c-result');

  // 4. ordering remains A -> B -> C (each starts only once the previous settled)
  assert.deepEqual(order, ['A', 'B', 'C']);
});

test('the internal recovery never produces an unhandled rejection, even under many interleaved failures', async () => {
  const queue = createSerialQueue();
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        queue.enqueue(async () => {
          if (i % 3 === 1) throw new Error(`synthetic failure ${i}`);
          return i;
        })
      )
    );
    // Every third-ish operation rejected to its own caller, as expected —
    // Promise.allSettled already consumed each one, so nothing here is
    // itself an unhandled rejection.
    assert.ok(results.some((r) => r.status === 'rejected'));
    assert.ok(results.some((r) => r.status === 'fulfilled'));

    // Give any stray unhandled rejection a turn of the microtask/macrotask
    // queue to surface before asserting none did.
    // 6. recovered internal queue does not produce unhandled rejections
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(unhandled, []);
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
  }
});

test('operations never run concurrently — each starts only after the previous one has fully settled', async () => {
  const queue = createSerialQueue();
  let inFlight = 0;
  let maxConcurrent = 0;

  const runOne = (shouldFail: boolean) => queue.enqueue(async () => {
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    if (shouldFail) throw new Error('deliberate failure');
    return 'ok';
  });

  const results = await Promise.allSettled([runOne(false), runOne(true), runOne(false), runOne(false)]);
  assert.equal(maxConcurrent, 1, 'no two enqueued operations must ever be in flight at the same time');
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 3);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
});

// 7. scheduleFlush can continue after an earlier failed flush — modeled
// directly against the queue, the same primitive scheduleFlush's setTimeout
// callback calls flushNow (== queue.enqueue(...)) through.
test('a queue used the way scheduleFlush uses flushNow recovers after a scheduled flush fails', async () => {
  const queue = createSerialQueue();
  let flushCount = 0;
  const flushNow = (shouldFail: boolean) => queue.enqueue(async () => {
    flushCount += 1;
    if (shouldFail) throw new Error('transient Postgres failure');
    return { ok: flushCount };
  });

  const caughtErrors: unknown[] = [];
  // Mirrors scheduleFlush's own fire-and-forget `.catch(error => console.error(...))`.
  await flushNow(true).catch((error) => caughtErrors.push(error));
  assert.equal(caughtErrors.length, 1);

  // A later "scheduled" flush (e.g. the next debounce tick, or the next
  // explicit save) must still actually run and succeed.
  const recovered = await flushNow(false);
  assert.deepEqual(recovered, { ok: 2 });
});

// 8. insertMissingSalons can continue after an earlier failed queued
// operation, since it shares this same queue.
test('a queue used the way insertMissingSalons uses the shared queue keeps working after an earlier failure', async () => {
  const queue = createSerialQueue();
  const inserted: string[] = [];

  const failingFlush = queue.enqueue(async () => { throw new Error('flush failed'); });
  await assert.rejects(failingFlush);

  const insertMissingSalons = (ids: string[]) => queue.enqueue(async () => {
    ids.forEach((id) => inserted.push(id));
    return {};
  });
  await insertMissingSalons(['salon-x', 'salon-y']);
  assert.deepEqual(inserted, ['salon-x', 'salon-y']);
});

// 9. close does not become permanently impossible only because an earlier
// operation failed — modeled the way postgresPersistence.close() awaits a
// final flushNow() through the same queue, then always releases the
// connection regardless of that flush's outcome.
test('a close-style final flush still runs (and the connection still gets released) after an earlier operation failed', async () => {
  const queue = createSerialQueue();
  let connectionClosed = false;

  const failingWrite = queue.enqueue(async () => { throw new Error('earlier write failed'); });
  await assert.rejects(failingWrite);

  const close = async (finalFlushShouldFail: boolean) => {
    let flushError: unknown;
    try {
      await queue.enqueue(async () => {
        if (finalFlushShouldFail) throw new Error('final flush failed');
        return {};
      });
    } catch (error) {
      flushError = error;
    }
    connectionClosed = true;
    if (flushError) throw flushError;
  };

  // The final flush itself succeeds because the queue recovered from the
  // earlier failure — close is not permanently broken by it.
  await assert.doesNotReject(close(false));
  assert.equal(connectionClosed, true);
});

test('a close-style final flush that itself fails still releases the connection before rethrowing', async () => {
  const queue = createSerialQueue();
  let connectionClosed = false;

  const close = async () => {
    let flushError: unknown;
    try {
      await queue.enqueue(async () => { throw new Error('final flush failed'); });
    } catch (error) {
      flushError = error;
    }
    connectionClosed = true;
    if (flushError) throw flushError;
  };

  await assert.rejects(close(), /final flush failed/);
  assert.equal(connectionClosed, true, 'the connection must be released even when the final flush itself fails');
});
