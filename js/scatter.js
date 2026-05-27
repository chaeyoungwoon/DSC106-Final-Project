// scatter.js

function drawScatter(state) {
  const container = document.getElementById("scatter-container");
  if (!container) return;

  const margin = { top: 36, right: 48, bottom: 60, left: 68 };
  const totalW = Math.max(container.clientWidth || 880, 500);
  const totalH = Math.min(520, Math.round(totalW * 0.66));
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top  - margin.bottom;

  const svg = d3.select(container).append("svg")
    .attr("viewBox",`0 0 ${totalW} ${totalH}`)
    .style("width","100%").style("display","block");

  const g = svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const pts = [...state.counties.values()].filter(d => d.poverty !== null && d.food !== null);

  const xScale = d3.scaleLinear().domain([0, 0.58]).range([0, W]);
  const yScale = d3.scaleLinear().domain([0, 0.30]).range([H, 0]);

  const ruralColor = d3.scaleSequential()
    .domain([0, 1])
    .interpolator(d3.interpolateRgb("#2e6080","#b89840"));

  // gridlines
  g.append("g").selectAll("line.gh").data(yScale.ticks(5)).join("line")
    .attr("x1",0).attr("x2",W).attr("y1",d=>yScale(d)).attr("y2",d=>yScale(d))
    .attr("stroke","#ddd8cc").attr("stroke-width",0.7);
  g.append("g").selectAll("line.gv").data(xScale.ticks(6)).join("line")
    .attr("x1",d=>xScale(d)).attr("x2",d=>xScale(d)).attr("y1",0).attr("y2",H)
    .attr("stroke","#ddd8cc").attr("stroke-width",0.7);

  const TICK = sel => sel
    .call(a => a.select(".domain").attr("stroke","#b0a894"))
    .call(a => a.selectAll("text").attr("fill","#6e6758")
      .style("font-family","'Fira Code', monospace").style("font-size","11px"));

  g.append("g").attr("transform",`translate(0,${H})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format(".0%")).ticks(7)).call(TICK);
  g.append("g")
    .call(d3.axisLeft(yScale).tickFormat(d3.format(".0%")).ticks(6)).call(TICK);

  g.append("text").attr("x",W/2).attr("y",H+48)
    .attr("text-anchor","middle").attr("fill","#4a4438")
    .style("font-family","'Fira Code', monospace").style("font-size","12px")
    .text("Children in Poverty (2023)");
  g.append("text").attr("transform","rotate(-90)").attr("x",-H/2).attr("y",-54)
    .attr("text-anchor","middle").attr("fill","#4a4438")
    .style("font-family","'Fira Code', monospace").style("font-size","12px")
    .text("Food Insecurity (2022)");

  // reference lines
  const rx = xScale(state.poverty75), ry = yScale(state.food75);
  g.append("line").attr("x1",rx).attr("x2",rx).attr("y1",0).attr("y2",H)
    .attr("stroke","#c07818").attr("stroke-width",1).attr("stroke-dasharray","5,3").attr("opacity",0.65);
  g.append("line").attr("x1",0).attr("x2",W).attr("y1",ry).attr("y2",ry)
    .attr("stroke","#c07818").attr("stroke-width",1).attr("stroke-dasharray","5,3").attr("opacity",0.65);

  // r value top-left
  g.append("text").attr("x",8).attr("y",20)
    .attr("fill","#6e6758")
    .style("font-family","'Fira Code', monospace").style("font-size","11px")
    .text("r = 0.768  |  n = 3,143 counties");

  // rural/urban legend
  const lx=W-120, ly=6;
  const defs=svg.append("defs");
  const grad=defs.append("linearGradient").attr("id","rural-grad").attr("x1","0%").attr("x2","100%");
  d3.range(11).forEach(i=>grad.append("stop").attr("offset",`${i*10}%`).attr("stop-color",ruralColor(i/10)));
  g.append("rect").attr("x",lx).attr("y",ly).attr("width",100).attr("height",8)
    .attr("fill","url(#rural-grad)").attr("rx",1);
  g.append("text").attr("x",lx).attr("y",ly+20).attr("fill","#9e9788")
    .style("font-family","'Fira Code', monospace").style("font-size","10px").text("Urban");
  g.append("text").attr("x",lx+100).attr("y",ly+20).attr("text-anchor","end")
    .attr("fill","#9e9788").style("font-family","'Fira Code', monospace").style("font-size","10px").text("Rural");

  // dot layers -- bg first so db renders on top
  const bgLayer = g.append("g").attr("class","dots-bg");
  const dbLayer = g.append("g").attr("class","dots-db");

  const bgDots = bgLayer.selectAll("circle")
    .data(pts.filter(d=>!d.doubleBurden)).join("circle")
      .attr("cx",d=>xScale(d.poverty)).attr("cy",d=>yScale(d.food))
      .attr("r",2.3)
      .attr("fill",d=>d.rural!==null?ruralColor(d.rural):"#9e9788")
      .attr("opacity",0.52);

  const dbDots = dbLayer.selectAll("circle")
    .data(pts.filter(d=>d.doubleBurden)).join("circle")
      .attr("cx",d=>xScale(d.poverty)).attr("cy",d=>yScale(d.food))
      .attr("r",2.9)
      .attr("fill","#a83318").attr("stroke","#c07818").attr("stroke-width",0.6)
      .attr("opacity",0.78);

  [bgLayer,dbLayer].forEach(layer=>{
    layer.selectAll("circle")
      .on("mousemove",(ev,d)=>showTooltip(ev,d))
      .on("mouseleave",hideTooltip)
      .on("click",(ev,d)=>fireCountySelect(d.fips));
  });

  // named county annotations
  const annotFips  = { "28049":"Holmes Co., MS", "55078":"Menominee Co., WI", "46137":"Ziebach Co., SD" };
  const offsets    = { "28049":[-20,28], "55078":[16,-22], "46137":[20,14] };
  Object.entries(annotFips).forEach(([fips,label])=>{
    const d = state.counties.get(fips);
    if (!d||d.poverty===null||d.food===null) return;
    const cx = xScale(d.poverty), cy = yScale(d.food);
    const [dx,dy] = offsets[fips];
    g.append("line").attr("x1",cx).attr("y1",cy).attr("x2",cx+dx).attr("y2",cy+dy)
      .attr("stroke","#7a2210").attr("stroke-width",0.9).attr("opacity",0.75);
    g.append("circle").attr("cx",cx).attr("cy",cy).attr("r",4.5)
      .attr("fill","none").attr("stroke","#7a2210").attr("stroke-width",1.3);
    g.append("text")
      .attr("x",cx+dx+(dx<0?-4:4)).attr("y",cy+dy-3)
      .attr("text-anchor",dx<0?"end":"start")
      .attr("fill","#7a2210")
      .style("font-family","'Fira Code', monospace").style("font-size","10px").style("font-weight","500")
      .text(label);
  });

  // county selection ring -- drawn on top of everything
  const selectionRing = g.append("circle")
    .attr("r",7).attr("fill","none")
    .attr("stroke","#1a1814").attr("stroke-width",2.5)
    .attr("opacity",0).attr("pointer-events","none");

  // state filter
  registerStateListener(abbr=>{
    bgDots
      .transition().duration(200)
      .attr("fill",d=>{
        if(abbr==="all") return d.rural!==null?ruralColor(d.rural):"#9e9788";
        return d.state===abbr?(d.rural!==null?ruralColor(d.rural):"#6a8ca0"):"#c8c2b0";
      })
      .attr("opacity",d=>abbr==="all"?0.52:(d.state===abbr?0.88:0.15))
      .attr("r",d=>abbr==="all"?2.3:(d.state===abbr?2.8:1.6));
    dbDots
      .transition().duration(200)
      .attr("opacity",d=>abbr==="all"?0.78:(d.state===abbr?0.95:0.12))
      .attr("r",d=>abbr==="all"?2.9:(d.state===abbr?3.6:1.8));
    // clear county selection ring when state changes
    selectionRing.attr("opacity",0);
  });

  // county selection -- move ring to that dot
  registerCountyListener(fips=>{
    const d = state.counties.get(fips);
    if (!d||d.poverty===null||d.food===null) {
      selectionRing.attr("opacity",0);
      return;
    }
    selectionRing
      .attr("cx",xScale(d.poverty))
      .attr("cy",yScale(d.food))
      .attr("opacity",1);
  });
}