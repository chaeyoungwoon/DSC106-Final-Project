// racechart.js -- larger clearer SVG text, warm atlas palette

const RACE_GROUPS = [
  { key:"pWhite",    label:"White",    color:"#2e6080" },
  { key:"pHispanic", label:"Hispanic", color:"#3d6e4a" },
  { key:"pAIAN",     label:"AIAN",     color:"#c07818" },
  { key:"pBlack",    label:"Black",    color:"#a83318" },
];

function drawRaceChart(state) {
  const container = document.getElementById("race-container");
  if (!container) return;

  const margin = { top: 24, right: 200, bottom: 64, left: 90 };
  const totalW = Math.max(container.clientWidth || 880, 500);
  const totalH = 260;
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top  - margin.bottom;

  const svg = d3.select(container).append("svg")
    .attr("viewBox",`0 0 ${totalW} ${totalH}`)
    .style("width","100%").style("display","block");

  const g = svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const yScale = d3.scaleBand()
    .domain(RACE_GROUPS.map(d=>d.label))
    .range([0,H]).padding(0.32);

  const xScale = d3.scaleLinear().domain([0,0.50]).range([0,W]);

  // gridlines
  g.append("g").selectAll("line").data(xScale.ticks(5)).join("line")
    .attr("x1",d=>xScale(d)).attr("x2",d=>xScale(d)).attr("y1",0).attr("y2",H)
    .attr("stroke","#ddd8cc").attr("stroke-width",0.7);

  const TICK = sel => sel
    .call(a=>a.select(".domain").attr("stroke","#b0a894"))
    .call(a=>a.selectAll("text").attr("fill","#6e6758")
      .style("font-family","'Fira Code', monospace").style("font-size","11px"));

  g.append("g").attr("class","x-axis").attr("transform",`translate(0,${H})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format(".0%")).ticks(5)).call(TICK);

  g.append("g").call(d3.axisLeft(yScale).tickSize(0))
    .call(a=>a.select(".domain").remove())
    .call(a=>a.selectAll("text")
      .attr("fill","#2c2820")
      .style("font-family","'Work Sans', sans-serif")
      .style("font-size","14px")
      .style("font-weight","500"));

  g.append("text").attr("x",W/2).attr("y",H+50)
    .attr("text-anchor","middle").attr("fill","#4a4438")
    .style("font-family","'Fira Code', monospace").style("font-size","12px")
    .text("Mean County-Level Child Poverty Rate");

  const barsG  = g.append("g");
  const annotG = g.append("g");

  function computeStats(fn) {
    return RACE_GROUPS.map(rc=>{
      const vals=[...state.counties.values()].filter(fn).map(d=>d[rc.key]).filter(v=>v!==null&&!isNaN(v));
      const mean=vals.length?d3.mean(vals):null;
      const sem=vals.length>1?d3.deviation(vals)/Math.sqrt(vals.length):0;
      return {...rc,mean,ci:1.96*sem,n:vals.length};
    });
  }

  function render(data,isNational){
    const maxVal=d3.max(data,d=>d.mean!==null?d.mean+d.ci:0)||0.5;
    xScale.domain([0,Math.min(0.65,maxVal*1.15)]);
    g.select("g.x-axis").remove();
    g.append("g").attr("class","x-axis").attr("transform",`translate(0,${H})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format(".0%")).ticks(5)).call(TICK);

    barsG.selectAll("rect.bar").data(data).join(e=>e.append("rect").attr("class","bar"),u=>u,x=>x.remove())
      .transition().duration(320)
      .attr("y",d=>yScale(d.label)).attr("height",yScale.bandwidth()).attr("x",0)
      .attr("width",d=>d.mean!==null?xScale(d.mean):0)
      .attr("fill",d=>d.color).attr("opacity",0.75);

    // CI lines
    barsG.selectAll("line.ci").data(data).join("line").attr("class","ci")
      .transition().duration(320)
      .attr("x1",d=>d.mean!==null?xScale(Math.max(0,d.mean-d.ci)):0)
      .attr("x2",d=>d.mean!==null?xScale(d.mean+d.ci):0)
      .attr("y1",d=>yScale(d.label)+yScale.bandwidth()/2)
      .attr("y2",d=>yScale(d.label)+yScale.bandwidth()/2)
      .attr("stroke",d=>d.color).attr("stroke-width",1.6);

    ["L","R"].forEach(s=>{
      barsG.selectAll(`line.cap${s}`).data(data).join("line").attr("class",`cap${s}`)
        .attr("x1",d=>d.mean?xScale(s==="L"?Math.max(0,d.mean-d.ci):d.mean+d.ci):0)
        .attr("x2",d=>d.mean?xScale(s==="L"?Math.max(0,d.mean-d.ci):d.mean+d.ci):0)
        .attr("y1",d=>yScale(d.label)+yScale.bandwidth()/2-5)
        .attr("y2",d=>yScale(d.label)+yScale.bandwidth()/2+5)
        .attr("stroke",d=>d.color).attr("stroke-width",1.4);
    });

    // value labels -- bigger and readable
    barsG.selectAll("text.val").data(data).join("text").attr("class","val")
      .transition().duration(320)
      .attr("x",d=>d.mean!==null?xScale(d.mean+d.ci)+10:10)
      .attr("y",d=>yScale(d.label)+yScale.bandwidth()/2+5)
      .attr("fill","#2c2820")
      .style("font-family","'Fira Code', monospace").style("font-size","11px")
      .text(d=>d.mean!==null?`${(d.mean*100).toFixed(1)}%  (n=${d.n.toLocaleString()})`:"No data");

    annotG.selectAll("*").remove();
    if(isNational){
      drawGap(annotG,yScale,xScale,W,"Black","White","t = 42.07",0);
      drawGap(annotG,yScale,xScale,W,"AIAN","White","t = 20.58",22);
    }

    // on-chart disclaimer
    annotG.append("text").attr("x",0).attr("y",H+62)
      .attr("fill","#9e9788")
      .style("font-family","'Fira Code', monospace").style("font-size","9px")
      .text("County-level means, not population-weighted national rates. Error bars = 95% CI.");
  }

  function drawGap(g,yScale,xScale,W,a,b,label,xOff){
    const ya=yScale(a)+yScale.bandwidth()/2;
    const yb=yScale(b)+yScale.bandwidth()/2;
    const ax=W+32+xOff;
    g.append("line").attr("x1",ax).attr("x2",ax).attr("y1",yb).attr("y2",ya)
      .attr("stroke","#b0a894").attr("stroke-width",1.2);
    [ya,yb].forEach(y=>{
      g.append("line").attr("x1",ax-5).attr("x2",ax+5).attr("y1",y).attr("y2",y)
        .attr("stroke","#b0a894").attr("stroke-width",1.2);
    });
    g.append("text").attr("x",ax+8).attr("y",(ya+yb)/2+4)
      .attr("fill","#6e6758")
      .style("font-family","'Fira Code', monospace").style("font-size","10px")
      .text(label+", p < 0.001");
  }

  render(computeStats(()=>true),true);
  registerStateListener(abbr=>{
    render(computeStats(abbr==="all"?()=>true:d=>d.state===abbr),abbr==="all");
  });
}