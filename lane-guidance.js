(function laneGuidanceModuleInit() {
  const demoState = {
    nextExit: "NJ Turnpike Exit 14 / I-78 East",
    distanceMi: "0.7 mi",
    direction: "I-95 NORTH",
    instruction: "KEEP LEFT FOR I-78 EAST",
    activeLanes: [1, 2],
    totalLanes: 5,
    routeLane: 1
  };

  function laneSvg(state) {
    const total = Math.max(4, Number(state.totalLanes) || 5);
    const width = 900;
    const height = 360;
    const roadTop = 28;
    const roadBottom = 320;
    const leftTop = 240;
    const rightTop = 660;
    const leftBottom = 70;
    const rightBottom = 830;
    const laneCount = total;
    const laneLines = [];

    for (let i = 0; i <= laneCount; i += 1) {
      const ratio = i / laneCount;
      const xTop = leftTop + (rightTop - leftTop) * ratio;
      const xBottom = leftBottom + (rightBottom - leftBottom) * ratio;
      laneLines.push(`
        <line x1="${xTop}" y1="${roadTop}" x2="${xBottom}" y2="${roadBottom}" class="lg-lane-line ${i === 0 || i === laneCount ? "lg-lane-edge" : ""}" />
      `);
    }

    const activeLanePaths = (state.activeLanes || []).map((laneIndex) => {
      const start = Math.max(0, Math.min(total - 1, laneIndex));
      const a = start / total;
      const b = (start + 1) / total;
      const x1t = leftTop + (rightTop - leftTop) * a;
      const x2t = leftTop + (rightTop - leftTop) * b;
      const x1b = leftBottom + (rightBottom - leftBottom) * a;
      const x2b = leftBottom + (rightBottom - leftBottom) * b;
      return `
        <path class="lg-active-lane" d="M ${x1t} ${roadTop} L ${x2t} ${roadTop} L ${x2b} ${roadBottom} L ${x1b} ${roadBottom} Z" />
      `;
    }).join("");

    const routeLane = Math.max(0, Math.min(total - 1, Number(state.routeLane) || 0));
    const rA = routeLane / total;
    const rB = (routeLane + 1) / total;
    const rx1t = leftTop + (rightTop - leftTop) * rA;
    const rx2t = leftTop + (rightTop - leftTop) * rB;
    const rx1b = leftBottom + (rightBottom - leftBottom) * rA;
    const rx2b = leftBottom + (rightBottom - leftBottom) * rB;
    const routeCenterTop = (rx1t + rx2t) / 2;
    const routeCenterBottom = (rx1b + rx2b) / 2;

    return `
      <svg viewBox="0 0 ${width} ${height}" class="lane-guidance-svg" aria-hidden="true">
        <defs>
          <linearGradient id="lgRoad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0.08)"></stop>
            <stop offset="100%" stop-color="rgba(255,255,255,0.03)"></stop>
          </linearGradient>
          <linearGradient id="lgRoute" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#8b5cf6"></stop>
            <stop offset="100%" stop-color="#6d28d9"></stop>
          </linearGradient>
          <marker id="lgArrow" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto">
            <path d="M1,1 L11,6 L1,11 Z" fill="#7c3aed"></path>
          </marker>
        </defs>

        <path
          class="lg-road-base"
          d="M ${leftTop} ${roadTop} L ${rightTop} ${roadTop} L ${rightBottom} ${roadBottom} L ${leftBottom} ${roadBottom} Z"
          fill="url(#lgRoad)"
        ></path>

        ${activeLanePaths}
        ${laneLines.join("")}

        <path
          class="lg-route-lane"
          d="M ${rx1t} ${roadTop} L ${rx2t} ${roadTop} L ${rx2b} ${roadBottom} L ${rx1b} ${roadBottom} Z"
          fill="url(#lgRoute)"
          opacity="0.88"
        ></path>

        <path
          d="M ${routeCenterTop} ${roadTop + 10} C ${routeCenterTop - 18} 130 ${routeCenterBottom - 8} 225 ${routeCenterBottom} ${roadBottom - 20}"
          stroke="#e9d5ff"
          stroke-width="10"
          fill="none"
          stroke-linecap="round"
          marker-end="url(#lgArrow)"
          opacity="0.92"
        ></path>
      </svg>
    `;
  }

  function interchangeSvg() {
    return `
      <svg viewBox="0 0 900 240" class="lane-guidance-interchange-svg" aria-hidden="true">
        <defs>
          <marker id="lgInterArrow" markerWidth="16" markerHeight="16" refX="8" refY="8" orient="auto">
            <path d="M1,1 L15,8 L1,15 Z" fill="#7c3aed"></path>
          </marker>
        </defs>
        <path d="M40 168 C 220 168, 310 156, 520 146 C 650 140, 760 142, 860 142" class="lg-inter-road"></path>
        <path d="M430 172 C 500 130, 560 90, 650 56 C 725 28, 786 28, 860 34" class="lg-inter-road"></path>
        <path d="M360 170 C 450 160, 540 148, 610 118 C 650 100, 690 78, 734 54" class="lg-inter-route" marker-end="url(#lgInterArrow)"></path>
      </svg>
    `;
  }

  function ensureNode(id) {
    return document.getElementById(id);
  }

  function renderLaneGuidanceDemo() {
    const topBar = ensureNode("laneGuidanceTopBar");
    const roadCanvas = ensureNode("laneGuidanceRoadCanvas");
    const interchange = ensureNode("laneInterchangePreview");
    if (!topBar || !roadCanvas || !interchange) return;

    topBar.innerHTML = `
      <div class="lane-guidance-next">${demoState.nextExit}</div>
      <div class="lane-guidance-meta-row">
        <div class="lane-guidance-pill">${demoState.distanceMi}</div>
        <div class="lane-guidance-pill lane-guidance-pill-route">${demoState.direction}</div>
      </div>
    `;

    roadCanvas.innerHTML = laneSvg(demoState);
    showInterchangePreview();
  }

  function showInterchangePreview() {
    const interchange = ensureNode("laneInterchangePreview");
    if (!interchange) return;
    interchange.innerHTML = `
      <div class="lane-interchange-card">
        <div class="lane-interchange-title">${demoState.instruction}</div>
        <div class="lane-interchange-sub">Demo preview for NY/NJ complex interchanges (simulated)</div>
        ${interchangeSvg()}
      </div>
    `;
  }

  function updateLaneGuidance(routeStepData) {
    // Placeholder API for future OSRM/GPS integration.
    if (!routeStepData || typeof routeStepData !== "object") return;
    Object.assign(demoState, routeStepData);
    renderLaneGuidanceDemo();
  }

  function bindLaneGuidanceUi() {
    const previewBtn = ensureNode("btnLaneInterchangePreview");
    if (previewBtn && !previewBtn.dataset.bound) {
      previewBtn.dataset.bound = "1";
      previewBtn.addEventListener("click", showInterchangePreview);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindLaneGuidanceUi();
    renderLaneGuidanceDemo();
  });

  window.LaneGuidanceModule = {
    renderLaneGuidanceDemo,
    showInterchangePreview,
    updateLaneGuidance
  };
})();
