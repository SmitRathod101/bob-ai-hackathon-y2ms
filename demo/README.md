# ChainMind AI — Demo Artifacts

## Demo Video

See [`demo-video-link.txt`](demo-video-link.txt) — will be recorded before final submission.

## Live Demo URL

See [`live-demo-url.txt`](live-demo-url.txt) — deployment URL will be filled before final submission.

## Screenshots

See [`screenshots/`](screenshots/) — will be captured from the running application.

## Demo Script

The recommended demonstration flow:

1. Open `http://localhost:5173` — Dashboard shows 250 shipments, 8 ports, fleet status
2. Navigate to **Crisis Simulation** tab
3. Select: Port Closure / Mumbai Port / 72h / High severity
4. Click **Run Crisis Simulation** — results calculate in real-time
5. Show: 78 affected shipments, ₹33+ Cr cargo exposed, cold-chain risk
6. Show: Three strategy cards (Cheapest / Fastest / AI Recommended)
7. Show: Explainable AI section with factor-by-factor reasoning
8. Change duration to **120h** and re-run — delay increases from ~245h to ~409h
9. Navigate to **What-If Comparison** tab
10. Run the pre-loaded 72h vs 120h comparison
11. Show: Delta table with % change per metric
12. Show: Radar chart multi-dimension comparison
13. Point out: recommendation may change between scenarios

## What the Demo Proves

- Results are **dynamically calculated** — not hardcoded
- Changing duration from 72h to 120h **visibly changes results**
- Three recovery strategies use **different trade-offs** (cost vs time vs balance)
- Explanation corresponds to **actual calculated values**
- System works **without any external API key**
