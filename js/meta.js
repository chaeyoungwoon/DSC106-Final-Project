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

let countyData    = new Map();  // fipscode → row object
let topoCounties  = null;
let topoStates    = null;
let currentMetric = "v024_rawvalue";
let selectedFips  = null;       // fipscode of the currently clicked county
let topFips       = null;       // fipscode of the highest-value county for currentMetric

// ── Auto-cycle state ──────────────────────────────────────────────────────────
const METRIC_KEYS  = Object.keys(METRICS);
let   metricIndex  = 0;         // index into METRIC_KEYS of the current metric
let   cycleTimer   = null;      // setInterval handle; null when paused
const CYCLE_MS     = 3000;      // ms between automatic metric advances

// ── SVG setup ─────────────────────────────────────────────────────────────────

const svg = d3.select("#choropleth")
  .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const projection = d3.geoAlbersUsa()
  .scale(1280)
  .translate([WIDTH / 2, HEIGHT / 2]);

const path = d3.geoPath().projection(projection);

// One wrapper <g> that the zoom transform is applied to.
// Both sub-groups move together when zooming/panning.
const mapGroup       = svg.append("g").attr("class", "map-group");
const countiesGroup  = mapGroup.append("g").attr("class", "counties-group");
const statesGroup    = mapGroup.append("g").attr("class", "states-group");
// These two layers sit above counties+states so the overlay is never occluded.
const highlightLayer = mapGroup.append("g").attr("class", "highlight-layer");
const labelLayer     = mapGroup.append("g").attr("class", "label-layer");

const tooltip = d3.select("#tooltip");

// ── Zoom behavior ─────────────────────────────────────────────────────────────
// scaleExtent: [1, 12] → can't zoom out past the natural size, max 12× in.

const zoom = d3.zoom()
  .scaleExtent([1, 12])
  .on("zoom", event => mapGroup.attr("transform", event.transform));

svg.call(zoom);

// Prevent the SVG background click from re-triggering when clicking counties.
svg.on("click", (event) => {
  if (event.target === svg.node()) resetZoom();
});

// ── Load data ─────────────────────────────────────────────────────────────────

Promise.all([
  d3.json(TOPO_URL),
  // The CSV has two header rows; skip the first (long descriptive names) and
  // use the second (coded names like v024_rawvalue) as the real header.
  fetch(CSV_PATH)
    .then(r => r.text())
    .then(text => {
      const lines  = text.split("\n");
      const stripped = lines.slice(1).join("\n");
      return d3.csvParse(stripped);
    }),
]).then(([topo, rows]) => {
  topoCounties = topojson.feature(topo, topo.objects.counties);
  topoStates   = topojson.mesh(topo, topo.objects.states, (a, b) => a !== b);

  // Keep only county-level rows (countycode !== "000")
  rows.forEach(row => {
    if (row.countycode && row.countycode !== "000" && row.fipscode && row.fipscode !== "00000") {
      countyData.set(row.fipscode, row);
    }
  });

  drawMap();
  drawStateBorders();
  updateColors(currentMetric);
  startCycle();   // begin auto-cycling now that the map is ready
}).catch(err => {
  console.error("Failed to load data:", err);
});

// ── Draw county paths (once) ──────────────────────────────────────────────────

function drawMap() {
  countiesGroup.selectAll("path.county")
    .data(topoCounties.features)
    .join("path")
      .attr("class", "county")
      .attr("d", path)
      .on("mousemove", onMouseMove)
      .on("mouseleave", onMouseLeave)
      .on("click", onCountyClick);
}

function drawStateBorders() {
  statesGroup.append("path")
    .datum(topoStates)
    .attr("class", "state-border")
    .attr("d", path);
}

// ── Click-to-zoom ─────────────────────────────────────────────────────────────

// Shared selection logic used by both county-path clicks and label-card clicks.
function activateCounty(fips, feature) {
  if (fips === selectedFips) { resetZoom(); return; }
  selectedFips = fips;
  stopCycle();
  countiesGroup.selectAll("path.county")
    .classed("selected", d => d.id === fips)
    .classed("faded",    d => d.id !== fips);
  zoomToCounty(feature);
  const row = countyData.get(fips);
  updateDetailPanel(row);
  updateCountyDetailPanel(row);
  document.getElementById("reset-zoom").disabled = false;
}

function onCountyClick(event, d) {
  event.stopPropagation();
  activateCounty(d.id, d);
}

function zoomToCounty(d) {
  // Compute the bounding box of this county in SVG coordinate space.
  const [[x0, y0], [x1, y1]] = path.bounds(d);
  const dx = x1 - x0;
  const dy = y1 - y0;

  // Scale so the county fills ~80% of the viewport; cap at 12×.
  const scale = Math.min(12, 0.8 / Math.max(dx / WIDTH, dy / HEIGHT));

  // Center the county in the viewport.
  const tx = WIDTH  / 2 - scale * (x0 + x1) / 2;
  const ty = HEIGHT / 2 - scale * (y0 + y1) / 2;

  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

function resetZoom() {
  selectedFips = null;
  countiesGroup.selectAll("path.county")
    .classed("selected", false)
    .classed("faded", false);

  svg.transition()
    .duration(600)
    .call(zoom.transform, d3.zoomIdentity);

  clearDetailPanel();
  updateCountyDetailPanel(null);
  document.getElementById("reset-zoom").disabled = true;
  startCycle();  // resume auto-cycling now that the user is back at the full map
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function updateDetailPanel(row) {
  const panel = document.getElementById("detail-panel");
  if (!row) {
    panel.innerHTML = `<p class="detail-hint">No data for this county.</p>`;
    return;
  }

  const metricRows = Object.entries(METRICS).map(([key, meta]) => {
    const v    = +row[key];
    const str  = isNaN(v) ? "No data" : meta.format(v);
    const cls  = isNaN(v) ? "metric-value no-data" : "metric-value";
    return `<li>
      <span class="metric-name">${meta.label}</span>
      <span class="${cls}">${str}</span>
    </li>`;
  }).join("");

  const topBadge = row.fipscode === topFips
    ? `<span class="top-badge">★ Highest in U.S. — ${METRICS[currentMetric].label}</span>`
    : "";

  panel.innerHTML = `
    <h3>${row.county}</h3>
    <span class="state-tag">${row.state}</span>
    ${topBadge}
    <ul class="detail-metrics">${metricRows}</ul>
  `;
}

function clearDetailPanel() {
  document.getElementById("detail-panel").innerHTML =
    `<p class="detail-hint">Click any county to see details.</p>`;
}

// ── Below-map county detail panel ─────────────────────────────────────────────

function updateCountyDetailPanel(row) {
  const section = document.getElementById("county-detail-panel");
  if (!row) {
    section.classList.add("hidden");
    return;
  }
  section.classList.remove("hidden");
  document.getElementById("detail-county-name").textContent =
    `${row.county}, ${row.state}`;
  // Iterate METRICS so this stays in sync with any future metric additions.
  Object.entries(METRICS).forEach(([key, meta]) => {
    const el = document.getElementById(`detail-${key}`);
    if (!el) return;
    const v = +row[key];
    el.textContent = isNaN(v) ? "No data" : meta.format(v);
  });
  // Scroll the panel into view so users don't miss it below the map.
  section.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Top-county finder ─────────────────────────────────────────────────────────

// Returns the fipscode of the county with the highest value for `metric`.
// Data lives in the countyData Map (fipscode → CSV row), not in d.properties.
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

  // Look up the GeoJSON feature (id = fipscode string in us-atlas v3).
  const feature = topoCounties.features.find(f => f.id === topFips);
  if (!feature) return;

  const row = countyData.get(topFips);
  if (!row) return;

  const [cx, cy] = path.centroid(feature);
  if (isNaN(cx) || isNaN(cy)) return;   // county is outside the projection

  const meta   = METRICS[metric];
  const v      = +row[metric];
  const fill   = isNaN(v) ? meta.noDataColor : colorScale(v);
  const valStr = isNaN(v) ? "No data" : meta.format(v);

  // ── Overlay path (shadow + float animation) ──────────────────────────────
  highlightLayer.append("path")
    .datum(feature)
    .attr("class", "projected-county")
    .attr("d", path)
    .attr("fill", fill);

  // ── Label card + callout line ─────────────────────────────────────────────

  // Place card to the right when county is in the left 58% of the map.
  const goRight = cx < WIDTH * 0.58;
  const CARD_W  = 192;
  const CARD_H  = 54;
  const GAP     = 18;   // horizontal gap between centroid and card edge

  const cardX     = goRight ? cx + GAP : cx - GAP - CARD_W;
  const cardY     = cy - CARD_H / 2;
  const lineEndX  = goRight ? cardX : cardX + CARD_W;
  const lineEndY  = cardY + CARD_H / 2;

  // Dashed callout from centroid to nearest card edge.
  labelLayer.append("line")
    .attr("class", "top-callout")
    .attr("x1", cx).attr("y1", cy)
    .attr("x2", lineEndX).attr("y2", lineEndY);

  // Card group — translate so internal coords start at (0, 0).
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

  // Make the whole card clickable — zooms into the top county.
  // feature and topFips are already in scope from the parent function.
  g.style("cursor", "pointer")
    .on("click", (event) => {
      event.stopPropagation();
      activateCounty(topFips, feature);
    });
}

// ── Color update (runs on every metric change) ────────────────────────────────

function updateColors(metric) {
  const meta   = METRICS[metric];
  const values = [];

  countyData.forEach(row => {
    const v = +row[metric];
    if (!isNaN(v)) values.push(v);
  });

  const [lo, hi] = d3.extent(values);
  const colorScale = d3.scaleSequential(meta.scheme).domain([lo, hi]);

  // Recompute which county has the highest value for this metric.
  topFips = findTopCounty(metric);

  const paths = countiesGroup.selectAll("path.county");

  // Classes change instantly — CSS transitions handle opacity/stroke animation.
  paths.attr("class", d => {
    const row      = countyData.get(d.id);
    const v        = row ? +row[metric] : NaN;
    const base     = isNaN(v) ? "county no-data" : "county";
    const selected = d.id === selectedFips ? " selected" : "";
    const faded    = selectedFips && d.id !== selectedFips ? " faded" : "";
    const top      = d.id === topFips      ? " top"      : "";
    return base + selected + faded + top;
  });

  // Fill animates via D3 transition — CSS transitions cannot animate SVG
  // presentation attributes set with .attr(), so D3 must own this animation.
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
  const container = d3.select("#legend-container");
  container.selectAll("*").remove();

  const LEGEND_W = 260;
  const LEGEND_H = 14;
  const MARGIN_T = 22;

  // Start invisible, then fade in — gives a smooth feel after the fill transition.
  const lsvg = container.append("svg")
    .attr("width", LEGEND_W + 80)
    .attr("height", LEGEND_H + MARGIN_T + 20)
    .style("opacity", 0);

  lsvg.append("text")
    .attr("class", "legend-title")
    .attr("x", 0)
    .attr("y", 14)
    .text(meta.label);

  const defs  = lsvg.append("defs");
  const gradId = "legend-gradient";
  const grad  = defs.append("linearGradient").attr("id", gradId);

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

  // No-data swatch
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

  // Fade the legend in after it's fully built.
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

// Move to the next metric and update everything.
function advanceMetric() {
  metricIndex   = (metricIndex + 1) % METRIC_KEYS.length;
  currentMetric = METRIC_KEYS[metricIndex];
  d3.select("#metric-select").property("value", currentMetric);
  updateColors(currentMetric);
}

function startCycle() {
  if (cycleTimer) return;                     // already running
  cycleTimer = setInterval(advanceMetric, CYCLE_MS);
  const btn = document.getElementById("cycle-toggle");
  btn.textContent = "❚❚ Pause";
  btn.classList.remove("paused");
}

function stopCycle() {
  if (!cycleTimer) return;                    // already stopped
  clearInterval(cycleTimer);
  cycleTimer = null;
  const btn = document.getElementById("cycle-toggle");
  btn.textContent = "▶ Play";
  btn.classList.add("paused");
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

d3.select("#metric-select").on("change", function () {
  currentMetric = this.value;
  metricIndex   = METRIC_KEYS.indexOf(currentMetric);
  // Reset the interval so the next auto-advance is 3 s from *now*, not from
  // whenever the old timer would have fired.
  if (cycleTimer) { stopCycle(); startCycle(); }
  updateColors(currentMetric);
});

// ── Buttons ───────────────────────────────────────────────────────────────────

document.getElementById("cycle-toggle").addEventListener("click", () => {
  cycleTimer ? stopCycle() : startCycle();
});

document.getElementById("reset-zoom").addEventListener("click", resetZoom);
