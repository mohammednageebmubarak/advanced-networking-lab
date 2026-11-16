import test from 'node:test';
import assert from 'node:assert/strict';
import { flowTrace, stopArqTrace, recoveryTrace, stuff, unstuff, flag } from './protocols.mjs';

test('flow respects the window, propagation delay and modulo-8 numbering', () => {
  for (const window of [1, 2, 4, 7]) {
    for (let delay = 0; delay <= 8; delay++) {
      const events = flowTrace(window, delay);
      assert.equal(events.at(-1).confirmed, 12);
      assert.ok(events.every(({ sent, confirmed }) => sent - confirmed <= window && sent >= confirmed));
      assert.ok(events.every(({ time }, i) => !i || events[i - 1].time <= time));
      assert.equal(events.find(event => event.kind === 'ack').time, 1 + 2 * delay);
      assert.equal(events.filter(event => event.kind === 'data')[8].label, 'Frame 0');
    }
  }
});

test('stop-and-wait recovers and delivers each frame once', () => {
  for (const loss of ['none', 'frame', 'ack']) {
    const events = stopArqTrace(loss);
    assert.equal(events.at(-1).delivered, 2);
    assert.equal(events.at(-1).retries, Number(loss !== 'none'));
    assert.equal(events.at(-1).label, 'ACK 0');
  }
  const acknowledgmentLoss = stopArqTrace('ack');
  assert.equal(acknowledgmentLoss.find(event => event.text.includes('duplicate')).delivered, 1);
});

test('recovery compares identical losses including first and last frame', () => {
  for (let missing = 0; missing < 5; missing++) {
    const goBack = recoveryTrace(false, missing);
    const selective = recoveryTrace(true, missing);
    assert.equal(goBack.at(-1).delivered, 5);
    assert.equal(selective.at(-1).delivered, 5);
    assert.equal(goBack.at(-1).retries, 5 - missing);
    assert.equal(selective.at(-1).retries, 1);
    assert.equal(selective.at(-1).buffer.length, 0);
    assert.equal(Math.max(...selective.map(event => event.buffer.length)), 4 - missing);
  }
});

test('stuffed data contains no HDLC flag and decodes losslessly', () => {
  for (let n = 0; n < 1024; n++) {
    const original = n.toString(2).padStart(10, '0');
    const encoded = stuff(original).map(({ bit }) => bit).join('');
    assert.ok(!encoded.includes(flag));
    assert.equal(unstuff(encoded), original);
  }
  assert.throws(() => unstuff('111111'));
});
