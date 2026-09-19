Debugging, Breakpoints & Live Variables
=====================================

Overview
--------
This document explains how to use the built-in debugger features: breakpoints, pause/step/continue, and the Live Variable Watch panel.

What you get
------------
- Per-node breakpoints: click the small dot on any node to toggle a breakpoint.
- Toolbar controls: Run, Debug Run, Pause, Step, Continue.
- SSE-driven live events: the engine streams node events and includes snapshots of variables/logs/outputs.
- Live Variable Watch: shows the latest variable snapshot while the flow runs or when paused.

Quick usage
-----------
1. Build a flow on the Builder page (Start → nodes → End).
2. Click the small dot on a node to add a breakpoint (dot turns red).
3. Click `Run` to run normally or `Debug Run` to auto-pause at the first node.
4. When execution pauses the paused node is highlighted in orange. Use `Step` to execute the paused node, or `Continue` to resume.
5. Watch variables in the Live Variable panel — values update while the flow runs and reflect the state when paused.

Common pitfalls
---------------
- No variables shown until nodes set them: the variable watch displays values only after nodes write to variables (e.g., `Input` or `Math`).
- Breakpoints must be toggled before starting a run (or added during a run via the control API).
- If you disconnect from the page while a run is active, the run continues on the server; reconnecting will not resume the same SSE session.

Troubleshooting
---------------
- If `Step`/`Pause` don't appear to work, open browser DevTools Network tab and inspect the POST to `/api/executions/:runId/control` — it should return HTTP 200.
- If variables are stale, ensure the node event payload contains `variables` (engine emits snapshots at node boundaries).

Next improvements
-----------------
- Persist breakpoints with the flow so they survive reloads.
- Add a watch expression UI to pin arbitrary expressions.
- Show execution trace replay (time-travel) from history.
