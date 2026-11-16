import { flowTrace, stopArqTrace, recoveryTrace, flag, stuff, unstuff } from './protocols.mjs';

const lessons = [
  ['requirements', 'Data Link Control', 'Why links need control', 'A physical link carries bits. Data link control adds rules so directly connected stations can exchange frames reliably.'],
  ['stop-wait', 'Flow Control', 'Stop-and-Wait', 'The sender transmits one frame and waits for an acknowledgment. If the receiver needs more time, it can withhold the acknowledgment.'],
  ['sliding-window', 'Flow Control', 'Sliding Window', 'The sender can have several numbered frames outstanding. A cumulative acknowledgment identifies the next expected sequence and opens space in the sender window.'],
  ['error-control', 'Error Control', 'Error Control and ARQ', 'Automatic Repeat Request (ARQ) combines error detection, acknowledgments and retransmission. Try losing a frame or its acknowledgment and observe how alternating sequence numbers prevent duplicate delivery.'],
  ['arq-comparison', 'Error Control', 'Go-Back-N vs Selective Reject', 'Run the same loss in two five-frame windows. Go-Back-N discards frames beyond the gap. Selective Reject buffers them and requests only the missing frame.'],
  ['hdlc', 'High-Level Data Link Control', 'Stations and Transfer Modes', 'HDLC provides synchronous framing and flow and error control. Its stations and transfer modes determine who can issue commands and initiate transfers.'],
  ['hdlc-frame', 'High-Level Data Link Control', 'HDLC Frame Structure', 'Explore the fields in transmission order. Use the frame type controls to see how the information field depends on the frame type.'],
  ['bit-stuffing', 'High-Level Data Link Control', 'Flags and Bit Stuffing', 'A flag marks a frame boundary. Between the flags, the transmitter inserts a zero after every run of five ones. The receiver removes those zeros to recover the original bits.'],
  ['hdlc-operation', 'High-Level Data Link Control', 'HDLC Operation', 'Follow a balanced link from initialization through data transfer to disconnection. Select Step to follow the exchange.'],
];
const get = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let disposers = [];

get('outline').innerHTML = lessons.map(([id, group, title]) =>
  `<a class="card" href="#${id}"><span>${group}</span><strong>${title}</strong><span aria-hidden="true">↗</span></a>`).join('');

function route(shouldFocus = false) {
  // Hash links support direct access and native browser history on mobile.
  disposers.forEach(dispose => dispose());
  disposers = [];
  const index = lessons.findIndex(([id]) => '#' + id === location.hash);
  get('chapter').hidden = index !== -1;
  get('lesson').hidden = index === -1;
  if (index === -1) {
    document.title = 'Advanced Networking Visual Lab';
    if (shouldFocus) get('main').focus();
    return;
  }
  const [id, group, title, intro] = lessons[index];
  document.title = title + ' | Advanced Networking Visual Lab';
  get('group').textContent = group;
  get('lesson-title').textContent = title;
  get('intro').textContent = intro;
  const activity = get('activity');
  activity.replaceChildren();
  renderers[id](activity);
  const previous = lessons[index - 1];
  const next = lessons[index + 1];
  get('lesson-nav').innerHTML =
    (previous ? `<a href="#${previous[0]}">← ${previous[2]}</a>` : '<span></span>') +
    (next ? `<a href="#${next[0]}">${next[2]} →</a>` : '<a href="#chapter">Chapter outline →</a>');
  if (shouldFocus) get('lesson-title').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// A shared playback control keeps the protocol model independent of the DOM.
function playback(parent, title, build, stats, manual = false) {
  const root = document.createElement('section');
  root.className = 'panel';
  root.innerHTML = `<h2>${title}</h2>
    <div class="track" aria-hidden="true"><div class="endpoints"><span>Sender / A</span><span>Receiver / B</span></div><span class="packet" hidden></span></div>
    <div class="controls"><button class="primary" data-step>Step</button>${manual ? '' : '<button data-play>Play</button>'}<button data-reset>Reset</button></div>
    <div class="stats"></div><p class="status" role="status"></p>
    <details><summary>Event log</summary><ol class="steps"></ol></details>`;
  parent.append(root);
  const packet = root.querySelector('.packet');
  const track = root.querySelector('.track');
  const step = root.querySelector('[data-step]');
  const play = root.querySelector('[data-play]');
  const status = root.querySelector('.status');
  const metrics = root.querySelector('.stats');
  const log = root.querySelector('.steps');
  let events, index, timer, animation;

  function stop() {
    clearInterval(timer);
    timer = undefined;
    if (play) play.textContent = 'Play';
  }
  function reset() {
    stop();
    animation?.cancel();
    events = build();
    index = 0;
    packet.hidden = true;
    step.disabled = false;
    if (play) play.disabled = false;
    metrics.innerHTML = stats({});
    status.textContent = 'Ready. Select Step' + (play ? ' or Play.' : '.');
    log.replaceChildren();
  }
  function advance() {
    const event = events[index++];
    status.textContent = event.text;
    metrics.innerHTML = stats(event);
    const item = document.createElement('li');
    item.textContent = event.text;
    log.append(item);

    animation?.cancel();
    packet.hidden = false;
    packet.className = 'packet ' + event.kind;
    packet.textContent = event.label;
    const distance = Math.max(0, track.clientWidth * .84 - packet.offsetWidth);
    const end = event.kind === 'failure' ? distance / 2 : distance;
    const reverse = event.reverse || event.kind === 'ack';
    const origin = reverse ? distance : 0;
    const destination = event.kind === 'failure' ? end : reverse ? 0 : distance;
    const points = event.kind === 'wait' ? [end / 2, end / 2] : [origin, destination];
    packet.style.transform = `translateX(${points[1]}px)`;
    if (!reducedMotion.matches) {
      animation = packet.animate(points.map(x => ({ transform: `translateX(${x}px)` })),
        { duration: 475, easing: 'ease-out' });
    }
    if (index === events.length) {
      stop();
      step.disabled = true;
      if (play) play.disabled = true;
    }
  }
  step.onclick = () => { stop(); advance(); };
  if (play) play.onclick = () => {
    if (timer) { stop(); return; }
    play.textContent = 'Pause';
    timer = setInterval(advance, 1000);
    advance();
  };
  root.querySelector('[data-reset]').onclick = reset;
  disposers.push(() => { stop(); animation?.cancel(); });
  reset();
  return reset;
}

function flow(root, sliding) {
  root.innerHTML = `<h2>Frame transmission</h2>
    <div class="controls settings">
      ${sliding ? '<label>Sender window<select data-window><option>1</option><option>2</option><option selected>4</option><option>7</option></select></label>' : ''}
      <label>One-way propagation delay<input data-delay type="range" min="0" max="8" value="2"><span data-value></span></label>
    </div><p class="help">One time unit is the time to transmit a frame. ACK transmission is treated as instantaneous. The trace uses 3-bit sequence numbers and wraps after 7.</p>`;
  const delay = root.querySelector('[data-delay]');
  const windowSize = root.querySelector('[data-window]');
  const windowValue = () => Number(windowSize?.value ?? 1);
  const reset = playback(root, 'Link trace', () => flowTrace(windowValue(), Number(delay.value)), event => {
    const { sent = 0, confirmed = 0, time = 0 } = event;
    const utilization = Math.min(1, windowValue() / (1 + 2 * Number(delay.value)));
    return `<span>Time <b>${time}</b></span><span>Outstanding <b>${sent - confirmed} / ${windowValue()}</b></span><span>Confirmed <b>${confirmed} / 12</b></span><span>Ideal utilization <b>${Math.round(utilization * 100)}%</b></span>`;
  });
  const refresh = () => {
    root.querySelector('[data-value]').textContent = delay.value + ' frame times';
    reset();
  };
  delay.oninput = refresh;
  if (windowSize) windowSize.onchange = refresh;
  refresh();
}

const metrics = ({ delivered = 0, retries = 0, buffer = [] }) =>
  `<span>Delivered <b>${delivered}</b></span><span>Retransmissions <b>${retries}</b></span><span>Buffered <b>${buffer.length ? buffer.join(', ') : 'Empty'}</b></span>`;

const hdlcFields = [
  ['Opening flag', '8 bits', 'The receiver looks for 01111110 to synchronize with the beginning of a frame.'],
  ['Address', 'Typically 8 bits', 'Identifies the secondary station sending or receiving the frame. The all-ones single-octet address is broadcast.'],
  ['Control', '8 or 16 bits', 'Identifies I-, S- or U-frames. The Poll/Final bit solicits a reply in a command or marks the solicited reply in a response. Basic I/S numbering uses 3 bits. Extended I/S numbering uses 7 bits.'],
  ['Information', 'Variable', 'Carries a whole number of octets in I-frames and in some U-frames.'],
  ['FCS', '16 or 32 bits', 'A cyclic redundancy check detects corruption in the address, control and any information field. The flags are outside the calculation.'],
  ['Closing flag', '8 bits', 'The 01111110 pattern marks the end. A flag may also open the next frame.'],
];

function frameInspector(root) {
  root.innerHTML = `<h2>Frame inspector</h2>
    <label>Frame type <select><option value="I">I · Information</option><option value="S">S · Supervisory</option><option value="U">U · Unnumbered</option></select></label>
    <p data-type></p><div class="fields" role="group" aria-label="HDLC fields"></div><div class="field-info" aria-live="polite"></div>`;
  const type = root.querySelector('select');
  const fields = root.querySelector('.fields');
  const descriptions = {
    I: 'I-frames carry user data and can piggyback acknowledgments.',
    S: 'S-frames carry flow and error control when acknowledgments cannot be piggybacked.',
    U: 'U-frames manage the link. Some U-frame functions can carry information.',
  };
  let selected = 0;
  function show(index) {
    selected = index;
    fields.querySelectorAll('button').forEach(button =>
      button.setAttribute('aria-pressed', String(Number(button.dataset.index) === selected)));
    const [name, width, description] = hdlcFields[index];
    const shownWidth = index === 2 && type.value === 'U' ? '8 bits' : width;
    root.querySelector('.field-info').innerHTML = `<strong>${name} · ${shownWidth}</strong><p>${description}</p>`;
  }
  fields.onclick = event => {
    const button = event.target.closest('button');
    if (button) show(Number(button.dataset.index));
  };
  function changeType() {
    root.querySelector('[data-type]').textContent = descriptions[type.value];
    fields.innerHTML = hdlcFields.map(([name], index) => {
      if (type.value === 'S' && index === 3) return '';
      return `<button data-index="${index}">${name}${type.value === 'U' && index === 3 ? ' (optional)' : ''}</button>`;
    }).join('');
    show(type.value === 'S' && selected === 3 ? 2 : selected);
  }
  type.onchange = changeType;
  changeType();
}

function bitLab(root) {
  root.innerHTML = `<h2>Bit stuffing encoder</h2>
    <label for="bit-input">Bits between the flags</label>
    <div class="controls"><input id="bit-input" class="bit-input" type="text" inputmode="numeric" value="011111101111100" maxlength="128" autocomplete="off" aria-describedby="bit-help">
    <button data-example>Flag-like input</button><button data-run>Long run of ones</button></div>
    <p id="bit-help" class="help">Use 0 and 1, up to 128 digits. Highlighted zeros are inserted by the sender. This models the bits inside the frame as a single input.</p>
    <p role="status" data-result></p>
    <strong>On the wire (with flags)</strong><output class="bits" data-wire></output>
    <strong>Recovered by the receiver</strong><output class="bits" data-recovered></output>
    <p>After five consecutive ones, the receiver checks the next bits. A zero is removed. Six ones followed by zero identify a flag when preceded by zero. Seven consecutive ones signal an abort.</p>`;
  const input = root.querySelector('input');
  function update() {
    const result = root.querySelector('[data-result]');
    const wire = root.querySelector('[data-wire]');
    const recovered = root.querySelector('[data-recovered]');
    const bits = input.value.trim();
    const valid = /^[01]+$/.test(bits);
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid) {
      result.textContent = 'Enter a binary sequence using 0 and 1.';
      wire.textContent = '';
      recovered.textContent = '';
      return;
    }
    const encoded = stuff(bits);
    wire.innerHTML = flag + ' · ' + encoded.map(({ bit, inserted }) =>
      inserted ? '<mark aria-label="inserted zero">0</mark>' : bit).join('') + ' · ' + flag;
    recovered.textContent = unstuff(encoded.map(({ bit }) => bit).join(''));
    const count = encoded.length - bits.length;
    result.textContent = count === 1 ? '1 zero inserted.' : count + ' zeros inserted.';
  }
  input.oninput = update;
  root.querySelector('[data-example]').onclick = () => { input.value = '01111110'; update(); };
  root.querySelector('[data-run]').onclick = () => { input.value = '111111111111'; update(); };
  update();
}

const renderers = {
  requirements(root) {
    root.innerHTML = `<h2>What the link layer controls</h2><dl>
      <dt><strong>Frame synchronization</strong></dt><dd>Identify where each frame begins and ends.</dd>
      <dt><strong>Flow control</strong></dt><dd>Keep the sender within the receiver’s handling capacity.</dd>
      <dt><strong>Error control</strong></dt><dd>Detect damaged frames and recover from loss or corruption.</dd>
      <dt><strong>Addressing</strong></dt><dd>Identify stations sharing the link.</dd>
      <dt><strong>Control and data</strong></dt><dd>Distinguish control information from user data.</dd>
      <dt><strong>Link management</strong></dt><dd>Establish, maintain and terminate exchanges.</dd></dl>`;
  },
  'stop-wait': root => flow(root, false),
  'sliding-window': root => flow(root, true),
  'error-control'(root) {
    root.innerHTML = `<label>Channel event <select><option value="frame">Lose first data frame</option><option value="ack">Lose first acknowledgment</option><option value="none">No loss</option></select></label>`;
    const fault = root.querySelector('select');
    fault.onchange = playback(root, 'Stop-and-Wait ARQ', () => stopArqTrace(fault.value), metrics);
  },
  'arq-comparison'(root) {
    root.innerHTML = `<label>Frame to lose <select><option>0</option><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label>
     <p class="help">Each trace sends a full window before feedback arrives. Only the first transmission of the selected frame is lost. Compare the retransmission totals after both traces finish.</p>`;
    const missing = root.querySelector('select');
    const goBack = playback(root, 'Go-Back-N', () => recoveryTrace(false, Number(missing.value)), metrics);
    const selective = playback(root, 'Selective Reject', () => recoveryTrace(true, Number(missing.value)), metrics);
    missing.onchange = () => { goBack(); selective(); };
  },
  hdlc(root) {
    root.innerHTML = `<h2>Station types and configurations</h2><p>A primary station issues commands, and a secondary station responds. This is an unbalanced configuration. In a balanced configuration, two combined stations can each issue commands and responses.</p>
    <h2>Transfer modes</h2><details open><summary>Normal Response Mode (NRM)</summary><p>Unbalanced. A secondary transmits in response to the primary’s permission.</p></details>
    <details><summary>Asynchronous Balanced Mode (ABM)</summary><p>Balanced. Either station can initiate transmission without polling the other first.</p></details>
    <details><summary>Asynchronous Response Mode (ARM)</summary><p>Unbalanced. A secondary may initiate transmission without explicit permission. The primary retains responsibility for link management.</p></details>`;
  },
  'hdlc-frame': frameInspector,
  'bit-stuffing': bitLab,
  'hdlc-operation'(root) {
    const exchange = [
      ['data', 'SABM', 'Initialization. Station A requests Asynchronous Balanced Mode.'],
      ['ack', 'UA', 'Station B accepts and both stations initialize their sequence state.'],
      ['data', 'I(0,0)', 'Data transfer. A sends information frame 0 and indicates that it expects frame 0 from B.'],
      ['ack', 'RR 1', 'B reports Receive Ready and confirms frame 0 by indicating it expects frame 1.'],
      ['data', 'DISC', 'Disconnection. A requests termination of the link.'],
      ['ack', 'UA', 'B acknowledges the disconnect. The link is closed.'],
    ].map(([kind, label, text]) => ({ kind, label, text }));
    playback(root, 'Balanced link exchange', () => exchange, () => '', true);
    root.insertAdjacentHTML('beforeend', '<p class="help">RR indicates readiness. RNR asks the peer to suspend data transmission. REJ requests retransmission starting at the missing sequence. SREJ requests a single frame.</p>');
  },
};

document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  get('main').focus();
});
window.addEventListener('hashchange', () => route(true));
route();
