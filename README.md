# Advanced Networking Visual Lab

An English-language, dependency-free browser lab for Chapter 7, Data Link Control Protocols.

## Sources and lesson map

The primary source is the uploaded `07-DataLinkControl.ppt`, lecture slides prepared by **Dr Lawrie Brown (UNSW@ADFA)** for William Stallings’ *Data and Computer Communications*, 8th edition. The textbook’s Chapter 7 is the supporting reference. The site follows the slide sequence and uses original lesson text and simulations.

| Slide topics | Activities |
| --- | --- |
| Data link requirements | Frame synchronization, flow and error control, addressing, control information and link management |
| Flow control | Stop-and-Wait, link utilization and Sliding Window |
| Error control | Stop-and-Wait ARQ and a matched loss scenario for Go-Back-N and Selective Reject |
| HDLC | Station types, configurations, transfer modes, frame fields, bit stuffing and a link exchange |

## Preview and verify

Serve this directory over HTTP, for example with `python -m http.server 8000`, and open `http://localhost:8000/`. Run `node --test protocols.test.mjs` to verify protocol behavior.

In the browser, try the loss options, change the slider and window, and verify the frame inspector and stuffing controls. At mobile width, enter a lesson and exercise both the chapter-outline link and the browser Back button. Hash links can be shared directly.

The flow trace idealizes ACK serialization and processing delay as zero. Its utilization estimates assume a sustained stream. The comparison uses one window, in-order arrivals apart from a single first-attempt loss, and immediate recovery once feedback arrives. Both paths display retransmission counts separately.

## Publish on GitHub Pages

Use the repository `mohammednageebmubarak/advanced-networking-lab`. Put these files at the root of `main`, including `.nojekyll`. In **Settings → Pages**, choose **Deploy from a branch**, then **main** and **/(root)**. Save and check the Pages deployment in **Actions**.

Open [the Pages URL](https://mohammednageebmubarak.github.io/advanced-networking-lab/) once deployment succeeds and repeat the browser checks against that URL.

## Source files

- `index.html` provides the page shell and attribution.
- `styles.css` defines the responsive layout, controls and simulation tracks.
- `lab.mjs` defines the lesson sequence, navigation and activity views.
- `protocols.mjs` implements deterministic event traces and the bit-stuffing codec.
- `protocols.test.mjs` verifies window limits, retransmission behavior and round-trip bit recovery.
