// choropleth.js
// Viz 1: county choropleth with a poverty threshold slider.
// Dragging the slider dims counties below the threshold, so the viewer can
// watch the double-burden cluster emerge as the threshold rises.
// Hover tooltip + county click for linked brushing.

function drawChoropleth(state) {
  const container = document.getElementById("map-container");
  if (!container) return;

  const doubleBurdenStroke = "#6F7D5C";
  const doubleBurdenStrokeWidth = 1.2;

  const W = container.clientWidth || 880;
  const H = Math.round(W * 0.615);

  const svg = d3.select(container).append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .style("width", "100%").style("display", "block");

  const proj = d3.geoAlbersUsa().scale(W * 1.27).translate([W/2, H/2]);
  const path = d3.geoPath().projection(proj);

  // pale straw to deep rust -- warm, map-like
  const colorScale = d3.scaleSequential()
    .domain([0, 0.54])
    .interpolator(d3.interpolateRgb("#ede8dc", "#7a1c08"));

  const countiesGeo = topojson.feature(state.topo, state.topo.objects.counties);
  const countyFeatures = new Map(
    countiesGeo.features.map(d => [d.id.toString().padStart(5, "0"), d])
  );
  const [[mapMinX, mapMinY], [mapMaxX, mapMaxY]] = path.bounds(countiesGeo);

  const countyPaths = svg.append("g").attr("class", "counties")
    .selectAll("path")
    .data(countiesGeo.features)
    .join("path")
      .attr("d", path)
      .attr("fill", d => {
        const c = state.counties.get(d.id.toString().padStart(5, "0"));
        return (c && c.poverty !== null) ? colorScale(c.poverty) : "#e5e0d3";
      })
      .attr("stroke", d => {
        const c = state.counties.get(d.id.toString().padStart(5, "0"));
        return (c && c.doubleBurden) ? doubleBurdenStroke : "none";
      })
      .attr("stroke-width", d => {
        const c = state.counties.get(d.id.toString().padStart(5, "0"));
        return (c && c.doubleBurden) ? doubleBurdenStrokeWidth : 0;
      })
      .on("mousemove", (event, d) => {
        const c = state.counties.get(d.id.toString().padStart(5, "0"));
        showTooltip(event, c);
      })
      .on("mouseleave", hideTooltip)
      .on("click", (event, d) => {
        fireCountySelect(d.id.toString().padStart(5, "0"));
      });

  // state borders
  svg.append("path")
    .datum(topojson.mesh(state.topo, state.topo.objects.states, (a, b) => a !== b))
    .attr("fill", "none")
    .attr("stroke", "#c0baa8")
    .attr("stroke-width", 0.65)
    .attr("d", path);

  // cluster annotations
  const annotations = [
    { lat: 33.1, lon: -90.4, label: "Mississippi Delta", dx: -54, dy: -26 },
    { lat: 37.4,  lon: -81.7, label: "Appalachian cluster", dx: -72, dy: -20 },
  ];
  annotations.forEach(ann => {
    const xy = proj([ann.lon, ann.lat]);
    if (!xy) return;
    const [x, y] = xy;
    svg.append("line")
      .attr("x1",x).attr("y1",y).attr("x2",x+ann.dx).attr("y2",y+ann.dy)
      .attr("stroke","#1a1814").attr("stroke-width",1.4).attr("opacity",0.95);
    svg.append("circle").attr("cx",x).attr("cy",y).attr("r",3)
      .attr("fill","#1a1814").attr("opacity",0.95);
    svg.append("text")
      .attr("x", x+ann.dx+(ann.dx<0?-4:4))
      .attr("y", y+ann.dy-4)
      .attr("text-anchor", ann.dx<0?"end":"start")
      .attr("fill","#3f1608")
      .style("font-family","'Fira Code', monospace")
      .style("font-size","11px")
      .style("font-weight","500")
      .text(ann.label);
  });

  const selectedCallout = svg.append("g")
    .attr("class","selected-county-callout")
    .attr("pointer-events","none");

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function updateSelectedCallout(fips) {
    selectedCallout.selectAll("*").remove();
    const feature = countyFeatures.get(fips);
    const county = state.counties.get(fips);
    if (!feature || !county) return;

    const [cx, cy] = path.centroid(feature);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;

    const side = [
      { key:"left",   dist: Math.abs(cx - mapMinX) },
      { key:"right",  dist: Math.abs(mapMaxX - cx) },
      { key:"top",    dist: Math.abs(cy - mapMinY) },
      { key:"bottom", dist: Math.abs(mapMaxY - cy) },
    ].sort((a,b) => a.dist - b.dist)[0].key;

    const label = `${county.name}, ${county.state}`;
    const edgePad = 18;
    const pad = 14;
    const labelWidth = Math.min(label.length * 6.4, W - edgePad * 2);
    const halfLabelWidth = labelWidth / 2;
    let labelX = cx;
    let labelY = cy;
    let lineX = cx;
    let lineY = cy;
    let anchor = "middle";

    if (side === "left") {
      labelX = edgePad;
      labelY = clamp(cy, 24, H - 18);
      lineX = labelX + labelWidth + 5;
      lineY = labelY - 4;
      anchor = "start";
    } else if (side === "right") {
      labelX = W - edgePad;
      labelY = clamp(cy, 24, H - 18);
      lineX = labelX - labelWidth - 5;
      lineY = labelY - 4;
      anchor = "end";
    } else if (side === "top") {
      labelX = clamp(cx, edgePad + halfLabelWidth, W - edgePad - halfLabelWidth);
      labelY = clamp(mapMinY - pad, 18, H - 18);
      lineX = labelX;
      lineY = labelY + 6;
    } else {
      labelX = clamp(cx, edgePad + halfLabelWidth, W - edgePad - halfLabelWidth);
      labelY = clamp(mapMaxY + pad, 18, H - 18);
      lineX = labelX;
      lineY = labelY - 14;
    }

    selectedCallout.append("line")
      .attr("x1",lineX).attr("y1",lineY)
      .attr("x2",cx).attr("y2",cy)
      .attr("stroke","#1a1814")
      .attr("stroke-width",1.6);

    selectedCallout.append("text")
      .attr("x",labelX)
      .attr("y",labelY)
      .attr("text-anchor",anchor)
      .attr("fill","#1a1814")
      .attr("stroke","#f5f1e8")
      .attr("stroke-width",3)
      .attr("paint-order","stroke")
      .style("font-family","'Fira Code', monospace")
      .style("font-size","10.5px")
      .style("font-weight","600")
      .text(label);
  }

  buildMapLegend(colorScale);

  // ---- SLIDER LOGIC ----
  // The slider controls a poverty threshold. Counties below it fade to near-invisible.
  // This shows the viewer how much of the country is above any given threshold.
  const slider    = document.getElementById("poverty-slider");
  const valLabel  = document.getElementById("slider-val");
  const countLabel= document.getElementById("slider-count");

  function applyThreshold(pct) {
    // pct comes in as a string from the slider (0-54)
    const threshold = parseFloat(pct) / 100;
    countyPaths
      .transition().duration(80)
      .attr("opacity", d => {
        const c = state.counties.get(d.id.toString().padStart(5, "0"));
        if (!c || c.poverty === null) return 0.15;
        return c.poverty >= threshold ? 1 : 0.08;
      });
    // update count label
    const above = [...state.counties.values()]
      .filter(c => c.poverty !== null && c.poverty >= threshold).length;
    if (valLabel)   valLabel.textContent   = parseFloat(pct).toFixed(0) + "%";
    if (countLabel) countLabel.textContent = `${above.toLocaleString()} counties above this threshold`;
  }

  if (slider) {
    slider.addEventListener("input", () => applyThreshold(slider.value));
    // set initial display
    applyThreshold(slider.value);
  }

  // respond to state filter
  registerStateListener(abbr => {
    countyPaths.attr("opacity", d => {
      if (abbr === "all") {
        // re-apply slider threshold
        const threshold = slider ? parseFloat(slider.value)/100 : 0;
        const c = state.counties.get(d.id.toString().padStart(5,"0"));
        if (!c || c.poverty === null) return 0.15;
        return c.poverty >= threshold ? 1 : 0.08;
      }
      const c = state.counties.get(d.id.toString().padStart(5, "0"));
      return (c && c.state === abbr) ? 1 : 0.12;
    });
  });

  // county click from other views
  registerCountyListener(fips => {
    countyPaths
      .attr("stroke", d => {
        const id = d.id.toString().padStart(5, "0");
        const c  = state.counties.get(id);
        if (id === fips) return "#1a1814";
        return (c && c.doubleBurden) ? doubleBurdenStroke : "none";
      })
      .attr("stroke-width", d => {
        const id = d.id.toString().padStart(5, "0");
        if (id === fips) return 2.5;
        const c = state.counties.get(id);
        return (c && c.doubleBurden) ? doubleBurdenStrokeWidth : 0;
      });
    updateSelectedCallout(fips);
  });
}

function buildMapLegend(colorScale) {
  const legendEl = document.getElementById("map-legend");
  if (!legendEl) return;
  legendEl.style.display = "flex";
  const svgEl = document.getElementById("legend-gradient-svg");
  if (!svgEl) return;
  const gs = d3.select(svgEl);
  const defs = gs.append("defs");
  const grad = defs.append("linearGradient").attr("id","pov-grad")
    .attr("x1","0%").attr("x2","100%");
  d3.range(11).forEach(i => {
    grad.append("stop").attr("offset",`${i*10}%`)
      .attr("stop-color", colorScale(i/10 * 0.54));
  });
  gs.append("rect").attr("width",160).attr("height",10)
    .attr("fill","url(#pov-grad)").attr("rx",1);
}
