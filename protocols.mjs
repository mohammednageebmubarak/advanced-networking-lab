// Each event represents one instructional step, independent of animation timing.
export function flowTrace(window, delay, total = 12) {
  const events = [];
  const flight = [];
  let sent = 0;
  let confirmed = 0;
  let time = 0;
  while (confirmed < total) {
    if (flight[0]?.ack <= time || sent - confirmed === window || sent === total) {
      const { ack } = flight.shift();
      time = Math.max(time, ack);
      confirmed++;
      events.push({ kind: 'ack', label: 'ACK ' + confirmed % 8, time, sent, confirmed,
        text: 'Receiver expects sequence ' + confirmed % 8 + '. The sender window advances.' });
    } else {
      const seq = sent % 8;
      flight.push({ ack: time + 1 + 2 * delay });
      sent++;
      events.push({ kind: 'data', label: 'Frame ' + seq, time, sent, confirmed,
        text: 'Send frame ' + (sent - 1) + ' with modulo-8 sequence ' + seq + '.' });
      time++;
    }
  }
  return events;
}

export function stopArqTrace(fault) {
  const events = [];
  const add = (kind, label, text, delivered, retries, reverse = false) =>
    events.push({ kind, label, text, delivered, retries, reverse });

  add('data', 'Frame 0', 'Send sequence 0 and start the timer.', 0, 0);
  if (fault === 'frame') {
    add('failure', 'Frame lost', 'The receiver gets no frame and sends no acknowledgment.', 0, 0);
  } else {
    add(fault === 'ack' ? 'failure' : 'ack', 'ACK 1',
      fault === 'ack' ? 'The receiver delivers frame 0, but ACK 1 is lost.' : 'Deliver frame 0. ACK 1 confirms it.', 1, 0, true);
  }
  const retries = Number(fault !== 'none');
  if (retries) {
    add('wait', 'Timeout', 'The sender timer expires before an acknowledgment arrives.', Number(fault === 'ack'), 0);
    add('data', 'Retry 0', 'Send frame 0 again with the same sequence number.', Number(fault === 'ack'), 1);
    add('ack', 'ACK 1', fault === 'ack'
      ? 'The receiver recognizes the duplicate, suppresses delivery, and repeats ACK 1.'
      : 'The receiver delivers frame 0 and acknowledges it.', 1, 1);
  }
  add('data', 'Frame 1', 'The sender toggles its sequence number and sends the next frame.', 1, retries);
  add('ack', 'ACK 0', 'Deliver frame 1. The receiver now expects sequence 0 again.', 2, retries);
  return events;
}

export function recoveryTrace(selective, missing, size = 5) {
  const events = [];
  let delivered = 0;
  let retries = 0;
  const buffer = new Set();
  const add = (kind, label, text) =>
    events.push({ kind, label, text, delivered, retries, buffer: [...buffer] });
  // The sender transmits one window before feedback reaches it.
  for (let i = 0; i < size; i++) {
    add('data', 'Frame ' + i, 'Send frame ' + i + '.');
  }
  for (let i = 0; i < size; i++) {
    if (i === missing) {
      add('failure', 'Lost ' + i, 'Frame ' + i + ' is lost on its first attempt.');
    } else if (i < missing) {
      delivered++;
      add('ack', 'ACK ' + delivered, 'Deliver frame ' + i + ' in order.');
    } else if (selective) {
      buffer.add(i);
      add('wait', 'Buffer ' + i, 'Keep frame ' + i + ' until the missing frame arrives.');
    } else {
      add('wait', 'Discard ' + i, 'Discard frame ' + i + ' because the receiver still expects frame ' + missing + '.');
    }
  }
  add(missing === size - 1 ? 'wait' : 'ack',
    missing === size - 1 ? 'Timeout' : (selective ? 'SREJ ' : 'REJ ') + missing,
    missing === size - 1 ? 'With no later frame to expose the gap, the sender timer expires.'
      : 'Feedback identifies the missing frame ' + missing + '.');
  const end = selective ? missing + 1 : size;
  for (let i = missing; i < end; i++) {
    retries++;
    add('data', 'Retry ' + i, 'Retransmit frame ' + i + '.');
    delivered++;
    while (buffer.delete(delivered)) delivered++;
    add('ack', 'ACK ' + delivered, 'The receiver has now delivered ' + delivered + ' frames in order.');
  }
  return events;
}

export const flag = '01111110';

export function stuff(bits) {
  let ones = 0;
  const output = [];
  for (const bit of bits) {
    output.push({ bit, inserted: false });
    ones = bit === '1' ? ones + 1 : 0;
    if (ones === 5) {
      output.push({ bit: '0', inserted: true });
      ones = 0;
    }
  }
  return output;
}

export function unstuff(bits) {
  let ones = 0;
  let output = '';
  for (let index = 0; index < bits.length; index++) {
    const bit = bits[index];
    output += bit;
    ones = bit === '1' ? ones + 1 : 0;
    if (ones === 5) {
      if (bits[++index] !== '0') throw new Error('Expected a stuffed zero.');
      ones = 0;
    }
  }
  return output;
}
