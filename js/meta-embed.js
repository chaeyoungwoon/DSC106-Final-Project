function initMetaGraph(containerId) {
  const root = document.getElementById(containerId);
  if (!root) return;
  const qs = sel => root.querySelector(sel);

  // ── Constants ─────────────────────────────────────────────────────────────────

  const TOPO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";
  const CSV_PATH = "data/analytic_data2025_v3.csv";

  const METRICS = {
    v024_rawvalue: { label: "Child Poverty Rate",                  format: d => `${(d * 100).toFixed(1)}%`, scheme: d3.interpolateOrRd,    noDataColor: "#e8d5cc" },
    v139_rawvalue: { label: "Food Insecurity Rate",                 format: d => `${(d * 100).toFixed(1)}%`, scheme: d3.interpolateYlOrBr,  noDataColor: "#e8e0cc" },
    v042_rawvalue: { label: "Poor Mental Health Days (avg/month)", format: d => `${d.toFixed(1)} days`,     scheme: d3.interpolatePurples, noDataColor: "#ddd5e8" },
    v145_rawvalue: { label: "Frequent Mental Distress Rate",        format: d => `${(d * 100).toFixed(1)}%`, scheme: d3.interpolateRdPu,    noDataColor: "#e8ccde" },
  };

  const WIDTH  = 960;
  const HEIGHT = 600;

  // ── State ─────────────────────────────────────────────────────────────────────

  let countyData    = new Map();
  let topoCounties  = null;
  let topoStates    = null;
  let currentMetric = "v024_rawvalue";
  let selectedFips  = null;
  let topFips       = null;

  // ── Auto-cycle state ──────────────────────────────────────────────────────────
  const METRIC_KEYS  = Object.keys(METRICS);
  let   metricIndex  = 0;
  let   cycleTimer   = null;
  const CYCLE_MS     = 3000;

  // ── SVG setup ─────────────────────────────────────────────────────────────────

  const svg = d3.select(qs("#meta-choropleth"))
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const projection = d3.geoAlbersUsa()
    .scale(1280)
    .translate([WIDTH / 2, HEIGHT / 2]);

  const path = d3.geoPath().projection(projection);

  const mapGroup       = svg.append("g").attr("class", "map-group");
  const countiesGroup  = mapGroup.append("g").attr("class", "counties-group");
  const statesGroup    = mapGroup.append("g").attr("class", "states-group");
  const highlightLayer = mapGroup.append("g").attr("class", "highlight-layer");
  const labelLayer     = mapGroup.append("g").attr("class", "label-layer");

  const tooltip = d3.select("#meta-tooltip");

  // ── Zoom behavior ─────────────────────────────────────────────────────────────

  const zoom = d3.zoom()
    .scaleExtent([1, 12])
    .on("zoom", event => mapGroup.attr("transform", event.transform));

  svg.call(zoom);

  svg.on("click", (event) => {
    if (event.target === svg.node()) resetZoom();
  });

  // ── Load data ─────────────────────────────────────────────────────────────────

  Promise.all([
    d3.json(TOPO_URL),
    fetch(CSV_PATH)
      .then(r => r.text())
      .then(text => {
        const lines   = text.split("\n");
        const stripped = lines.slice(1).join("\n");
        return d3.csvParse(stripped);
      }),
  ]).then(([topo, rows]) => {
    topoCounties = topojson.feature(topo, topo.objects.counties);
    topoStates   = topojson.mesh(topo, topo.objects.states, (a, b) => a !== b);

    rows.forEach(row => {
      if (row.countycode && row.countycode !== "000" && row.fipscode && row.fipscode !== "00000") {
        countyData.set(row.fipscode, row);
      }
    });

    drawMap();
    drawStateBorders();
    updateColors(currentMetric);
    startCycle();
  }).catch(err => {
    console.error("Failed to load meta graph data:", err);
  });

  // ── Draw county paths (once) ──────────────────────────────────────────────────

  function drawMap() {
    countiesGroup.selectAll("path.meta-county")
      .data(topoCounties.features)
      .join("path")
        .attr("class", "meta-county")
        .attr("d", path)
        .on("mousemove", onMouseMove)
        .on("mouseleave", onMouseLeave)
        .on("click", onCountyClick);
  }

  function drawStateBorders() {
    statesGroup.append("path")
      .datum(topoStates)
      .attr("class", "meta-state-border")
      .attr("d", path);
  }

  // ── Click-to-zoom ─────────────────────────────────────────────────────────────

  function activateCounty(fips, feature) {
    if (fips === selectedFips) { resetZoom(); return; }
    selectedFips = fips;
    stopCycle();
    countiesGroup.selectAll("path.meta-county")
      .classed("selected", d => d.id === fips)
      .classed("faded",    d => d.id !== fips);
    zoomToCounty(feature);
    const row = countyData.get(fips);
    updateDetailPanel(row);
    updateCountyDetailPanel(row);
    qs("#meta-reset-zoom").disabled = false;
  }

  function onCountyClick(event, d) {
    event.stopPropagation();
    activateCounty(d.id, d);
  }

  function zoomToCounty(d) {
    const [[x0, y0], [x1, y1]] = path.bounds(d);
    const dx = x1 - x0;
    const dy = y1 - y0;

    const scale = Math.min(12, 0.8 / Math.max(dx / WIDTH, dy / HEIGHT));

    const tx = WIDTH  / 2 - scale * (x0 + x1) / 2;
    const ty = HEIGHT / 2 - scale * (y0 + y1) / 2;

    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function resetZoom() {
    selectedFips = null;
    countiesGroup.selectAll("path.meta-county")
      .classed("selected", false)
      .classed("faded", false);

    svg.transition()
      .duration(600)
      .call(zoom.transform, d3.zoomIdentity);

    clearDetailPanel();
    updateCountyDetailPanel(null);
    qs("#meta-reset-zoom").disabled = true;
    startCycle();
  }

  // ── Detail panel ──────────────────────────────────────────────────────────────

  function updateDetailPanel(row) {
    const panel = qs("#meta-detail-panel");
    if (!row) {
      panel.innerHTML = `<p class="detail-hint">No data for this county.</p>`;
      return;
    }

    const metricRows = Object.entries(METRICS).map(([key, meta]) => {
      const v   = +row[key];
      const str = isNaN(v) ? "No data" : meta.format(v);
      const cls = isNaN(v) ? "metric-value no-data" : "metric-value";
      return `<li>
        <span class="metric-name">${meta.label}</span>
        <span class="${cls}">${str}</span>
      </li>`;
    }).join("");

    const topBadge = row.fipscode === topFips
      ? `<span class="top-badge">&#9733; Highest in U.S. &mdash; ${METRICS[currentMetric].label}</span>`
      : "";

    panel.innerHTML = `
      <h3>${row.county}</h3>
      <span class="state-tag">${row.state}</span>
      ${topBadge}
      <ul class="detail-metrics">${metricRows}</ul>
    `;
  }

  function clearDetailPanel() {
    qs("#meta-detail-panel").innerHTML =
      `<p class="detail-hint">Click any county to see details.</p>`;
  }

  // ── Below-map county detail panel ─────────────────────────────────────────────

  function updateCountyDetailPanel(row) {
    const section = qs("#meta-county-detail-panel");
    if (!row) {
      section.classList.add("hidden");
      return;
    }
    section.classList.remove("hidden");
    qs("#meta-detail-county-name").textContent = `${row.county}, ${row.state}`;
    Object.entries(METRICS).forEach(([key, meta]) => {
      const el = qs(`#meta-detail-${key}`);
      if (!el) return;
      const v = +row[key];
      el.textContent = isNaN(v) ? "No data" : meta.format(v);
    });
    section.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ── Top-county finder ─────────────────────────────────────────────────────────

  function findTopCounty(metric) {
    let bestFips = null;
    let bestVal  = -Infinity;
    countyData.forEach((row, fips) => {
      const v = +row[metric];
      if (!isNaN(v) && v > bestVal) { bestVal = v; bestFips = fips; }
    });
    return bestFips;
  }

  // ── Highest-county overlay ────────────────────────────────────────────────────

  function drawTopCountyOverlay(metric, colorScale) {
    highlightLayer.selectAll("*").remove();
    labelLayer.selectAll("*").remove();

    if (!topFips) return;

    const feature = topoCounties.features.find(f => f.id === topFips);
    if (!feature) return;

    const row = countyData.get(topFips);
    if (!row) return;

    const [cx, cy] = path.centroid(feature);
    if (isNaN(cx) || isNaN(cy)) return;

    const meta   = METRICS[metric];
    const v      = +row[metric];
    const fill   = isNaN(v) ? meta.noDataColor : colorScale(v);
    const valStr = isNaN(v) ? "No data" : meta.format(v);

    highlightLayer.append("path")
      .datum(feature)
      .attr("class", "projected-county")
      .attr("d", path)
      .attr("fill", fill);

    const goRight = cx < WIDTH * 0.58;
    const CARD_W  = 192;
    const CARD_H  = 54;
    const GAP     = 18;

    const cardX    = goRight ? cx + GAP : cx - GAP - CARD_W;
    const cardY    = cy - CARD_H / 2;
    const lineEndX = goRight ? cardX : cardX + CARD_W;
    const lineEndY = cardY + CARD_H / 2;

    labelLayer.append("line")
      .attr("class", "top-callout")
      .attr("x1", cx).attr("y1", cy)
      .attr("x2", lineEndX).attr("y2", lineEndY);

    const g = labelLayer.append("g")
      .attr("class", "highest-label-group")
      .attr("transform", `translate(${cardX},${cardY})`);

    g.append("rect")
      .attr("class", "highest-label-bg")
      .attr("width", CARD_W)
      .attr("height", CARD_H)
      .attr("rx", 7);

    g.append("text")
      .attr("class", "highest-label-title")
      .attr("x", 10)
      .attr("y", 22)
      .text(`${row.county}, ${row.state}`);

    g.append("text")
      .attr("class", "highest-label-value")
      .attr("x", 10)
      .attr("y", 41)
      .text(`${meta.label}: ${valStr}`);

    g.style("cursor", "pointer")
      .on("click", (event) => {
        event.stopPropagation();
        activateCounty(topFips, feature);
      });
  }

  // ── Color update ──────────────────────────────────────────────────────────────

  function updateColors(metric) {
    const meta   = METRICS[metric];
    const values = [];

    countyData.forEach(row => {
      const v = +row[metric];
      if (!isNaN(v)) values.push(v);
    });

    const [lo, hi] = d3.extent(values);
    const colorScale = d3.scaleSequential(meta.scheme).domain([lo, hi]);

    topFips = findTopCounty(metric);

    const paths = countiesGroup.selectAll("path.meta-county");

    paths.attr("class", d => {
      const row      = countyData.get(d.id);
      const v        = row ? +row[metric] : NaN;
      const base     = isNaN(v) ? "meta-county no-data" : "meta-county";
      const selected = d.id === selectedFips ? " selected" : "";
      const faded    = selectedFips && d.id !== selectedFips ? " faded" : "";
      const top      = d.id === topFips ? " top" : "";
      return base + selected + faded + top;
    });

    paths.transition()
      .duration(500)
      .ease(d3.easeCubicInOut)
      .attr("fill", d => {
        const row = countyData.get(d.id);
        if (!row) return meta.noDataColor;
        const v = +row[metric];
        return isNaN(v) ? meta.noDataColor : colorScale(v);
      });

    drawLegend(colorScale, lo, hi, meta);
    drawTopCountyOverlay(metric, colorScale);
  }

  // ── Legend ────────────────────────────────────────────────────────────────────

  function drawLegend(colorScale, lo, hi, meta) {
    const container = d3.select(qs("#meta-legend-container"));
    container.selectAll("*").remove();

    const LEGEND_W = 260;
    const LEGEND_H = 14;
    const MARGIN_T = 22;

    const lsvg = container.append("svg")
      .attr("width", LEGEND_W + 80)
      .attr("height", LEGEND_H + MARGIN_T + 20)
      .style("opacity", 0);

    lsvg.append("text")
      .attr("class", "legend-title")
      .attr("x", 0)
      .attr("y", 14)
      .text(meta.label);

    const defs   = lsvg.append("defs");
    const gradId = "meta-legend-gradient";
    const grad   = defs.append("linearGradient").attr("id", gradId);

    d3.range(11).forEach(i => {
      grad.append("stop")
        .attr("offset", `${i * 10}%`)
        .attr("stop-color", colorScale(lo + (i / 10) * (hi - lo)));
    });

    lsvg.append("rect")
      .attr("x", 0)
      .attr("y", MARGIN_T)
      .attr("width", LEGEND_W)
      .attr("height", LEGEND_H)
      .attr("rx", 3)
      .style("fill", `url(#${gradId})`);

    lsvg.append("rect")
      .attr("x", LEGEND_W + 8)
      .attr("y", MARGIN_T)
      .attr("width", LEGEND_H)
      .attr("height", LEGEND_H)
      .attr("rx", 2)
      .attr("fill", "#ddd")
      .attr("stroke", "#aaa")
      .attr("stroke-width", 0.5);

    lsvg.append("text")
      .attr("class", "legend-label")
      .attr("x", LEGEND_W + 26)
      .attr("y", MARGIN_T + LEGEND_H - 2)
      .text("No data");

    lsvg.append("text")
      .attr("class", "legend-label")
      .attr("x", 0)
      .attr("y", MARGIN_T + LEGEND_H + 14)
      .text(meta.format(lo));

    lsvg.append("text")
      .attr("class", "legend-label")
      .attr("x", LEGEND_W)
      .attr("y", MARGIN_T + LEGEND_H + 14)
      .attr("text-anchor", "end")
      .text(meta.format(hi));

    lsvg.transition().duration(400).style("opacity", 1);
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────────

  function onMouseMove(event, d) {
    const row    = countyData.get(d.id);
    const meta   = METRICS[currentMetric];
    const value  = row ? +row[currentMetric] : NaN;
    const name   = row ? row.county : `FIPS ${d.id}`;
    const state  = row ? row.state  : "";
    const valStr = (!row || isNaN(value)) ? "No data" : meta.format(value);

    tooltip
      .classed("hidden", false)
      .style("left", `${event.clientX + 14}px`)
      .style("top",  `${event.clientY - 10}px`)
      .html(`<strong>${name}${state ? `, ${state}` : ""}</strong>${meta.label}: ${valStr}`);
  }

  function onMouseLeave() {
    tooltip.classed("hidden", true);
  }

  // ── Auto-cycle ────────────────────────────────────────────────────────────────

  function advanceMetric() {
    metricIndex   = (metricIndex + 1) % METRIC_KEYS.length;
    currentMetric = METRIC_KEYS[metricIndex];
    d3.select(qs("#meta-metric-select")).property("value", currentMetric);
    updateColors(currentMetric);
  }

  function startCycle() {
    if (cycleTimer) return;
    cycleTimer = setInterval(advanceMetric, CYCLE_MS);
    const btn = qs("#meta-cycle-toggle");
    btn.innerHTML = "&#9646;&#9646; Pause";
    btn.classList.remove("paused");
  }

  function stopCycle() {
    if (!cycleTimer) return;
    clearInterval(cycleTimer);
    cycleTimer = null;
    const btn = qs("#meta-cycle-toggle");
    btn.innerHTML = "&#9654; Play";
    btn.classList.add("paused");
  }

  // ── Dropdown ──────────────────────────────────────────────────────────────────

  d3.select(qs("#meta-metric-select")).on("change", function () {
    currentMetric = this.value;
    metricIndex   = METRIC_KEYS.indexOf(currentMetric);
    if (cycleTimer) { stopCycle(); startCycle(); }
    updateColors(currentMetric);
  });

  // ── Buttons ───────────────────────────────────────────────────────────────────

  qs("#meta-cycle-toggle").addEventListener("click", () => {
    cycleTimer ? stopCycle() : startCycle();
  });

  qs("#meta-reset-zoom").addEventListener("click", resetZoom);
}
