// dotplot.js -- fixed: scroll to section-scatter not section-map,
// annotation positions don't overlap instruction text, cleaner layout

function drawDotPlot(state){
  const container=document.getElementById("dotplot-container");
  if(!container) return;

  const HIGH_POV=0.25;
  const byState=d3.rollup(
    [...state.counties.values()].filter(d=>d.poverty!==null&&d.poverty>HIGH_POV&&d.overdose!==null),
    v=>({meanOverdose:d3.mean(v,d=>d.overdose),meanPoverty:d3.mean(v,d=>d.poverty),n:v.length}),
    d=>d.state
  );

  let rows=[...byState.entries()]
    .map(([st,v])=>({state:st,...v}))
    .filter(d=>d.n>=3)
    .sort((a,b)=>b.meanOverdose-a.meanOverdose);

  const margin={top:20,right:170,bottom:64,left:56};
  const rowH=24;
  const totalH=rows.length*rowH+margin.top+margin.bottom;
  const totalW=Math.max(container.clientWidth||880,500);
  const W=totalW-margin.left-margin.right;
  const H=rows.length*rowH;

  const svg=d3.select(container).append("svg")
    .attr("viewBox",`0 0 ${totalW} ${totalH}`)
    .style("width","100%").style("display","block");

  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const xMax=d3.max(rows,d=>d.meanOverdose)*1.1;
  const xScale=d3.scaleLinear().domain([0,xMax]).range([0,W]);
  const yScale=d3.scaleBand().domain(rows.map(d=>d.state)).range([0,H]).padding(0.12);

  const povColor=d3.scaleSequential()
    .domain([0.25,d3.max(rows,d=>d.meanPoverty)])
    .interpolator(d3.interpolateRgb("#2e6080","#a83318"));

  // instruction text -- placed below the chart header not inside the plot
  // (avoid collision with annotations entirely)

  // gridlines
  g.append("g").selectAll("line.gv").data(xScale.ticks(6)).join("line")
    .attr("x1",d=>xScale(d)).attr("x2",d=>xScale(d)).attr("y1",0).attr("y2",H)
    .attr("stroke","#ddd8cc").attr("stroke-width",0.7);

  g.append("g").attr("transform",`translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(6))
    .call(a=>a.select(".domain").attr("stroke","#b0a894"))
    .call(a=>a.selectAll("text").attr("fill","#4a4438")
      .style("font-family","'Fira Code', monospace").style("font-size","12px"));

  g.append("text").attr("x",W/2).attr("y",H+50)
    .attr("text-anchor","middle").attr("fill","#2c2820")
    .style("font-family","'Fira Code', monospace").style("font-size","12px").style("font-weight","500")
    .text("Mean drug overdose deaths per 100,000 (counties with child poverty > 25%)");

  // "clear filter" link -- top right, only visible when a state is selected
  const resetLabel=g.append("text")
    .attr("x",W+8).attr("y",8)
    .attr("fill","#a83318").attr("opacity",0)
    .style("font-family","'Fira Code', monospace").style("font-size","11px")
    .style("cursor","pointer").style("text-decoration","underline")
    .text("clear filter")
    .on("click",()=>fireStateChange("all"));

  // state labels
  const stateLabels=g.append("g").selectAll("text.slbl").data(rows).join("text").attr("class","slbl")
    .attr("x",-8)
    .attr("y",d=>yScale(d.state)+yScale.bandwidth()/2+4)
    .attr("text-anchor","end").attr("fill","#4a4438")
    .style("font-family","'Fira Code', monospace").style("font-size","12px").style("font-weight","500")
    .text(d=>d.state);

  // track lines
  g.append("g").selectAll("line.track").data(rows).join("line").attr("class","track")
    .attr("x1",0).attr("x2",d=>xScale(d.meanOverdose))
    .attr("y1",d=>yScale(d.state)+yScale.bandwidth()/2)
    .attr("y2",d=>yScale(d.state)+yScale.bandwidth()/2)
    .attr("stroke","#c8c2b0").attr("stroke-width",0.7);

  // highlight bands for WV KY OH
  ["WV","KY","OH"].forEach(st=>{
    const row=rows.find(d=>d.state===st);
    if(!row) return;
    const cy=yScale(st)+yScale.bandwidth()/2;
    g.append("rect").attr("x",-44).attr("y",cy-10).attr("width",W+44).attr("height",22)
      .attr("fill","#a83318").attr("opacity",0.06).attr("rx",2);
  });

  const dots=g.append("g").selectAll("circle.sdot").data(rows).join("circle").attr("class","sdot")
    .attr("cx",d=>xScale(d.meanOverdose))
    .attr("cy",d=>yScale(d.state)+yScale.bandwidth()/2)
    .attr("r",7)
    .attr("fill",d=>povColor(d.meanPoverty))
    .attr("stroke","#f5f1e8").attr("stroke-width",1)
    .style("cursor","pointer")
    .on("mouseover",function(ev,d){
      d3.select(this).transition().duration(100).attr("r",9);
      const tt=document.getElementById("tooltip");
      document.getElementById("tt-name").textContent    = (STATE_NAMES[d.state]||d.state)+" — high-poverty counties";
      document.getElementById("tt-poverty").textContent = (d.meanPoverty*100).toFixed(1)+"% mean";
      document.getElementById("tt-food").textContent    = "see scatter";
      document.getElementById("tt-mental").textContent  = "see strip plots";
      document.getElementById("tt-drug").textContent    = d.meanOverdose.toFixed(1)+" /100k mean";
      document.getElementById("tt-badge").style.display="none";
      const x=Math.min(ev.clientX+16,window.innerWidth-300);
      const y=Math.min(ev.clientY+16,window.innerHeight-190);
      tt.style.left=x+"px"; tt.style.top=y+"px";
      tt.classList.add("visible");
    })
    .on("mouseout",function(ev,d){
      if(AppState.selectedState!==d.state)
        d3.select(this).transition().duration(100).attr("r",7);
      hideTooltip();
    })
    .on("click",(ev,d)=>{
      fireStateChange(d.state);
      // scroll to scatter (section 2) so viewer sees the filtered chart
      const el=document.getElementById("section-scatter");
      if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
    });

  // n labels
  g.append("g").selectAll("text.nlbl").data(rows).join("text").attr("class","nlbl")
    .attr("x",d=>xScale(d.meanOverdose)+12)
    .attr("y",d=>yScale(d.state)+yScale.bandwidth()/2+5)
    .attr("fill","#6e6758")
    .style("font-family","'Fira Code', monospace").style("font-size","10.5px")
    .text(d=>`n=${d.n}`);

  // suppression note -- wrapped into two shorter lines so it doesn't clip
  g.append("text").attr("x",0).attr("y",H+52)
    .attr("fill","#6e6758")
    .style("font-family","'Fira Code', monospace").style("font-size","9.5px")
    .text("Overdose estimates suppressed for counties with fewer than 10 deaths (2020-22).");
  g.append("text").attr("x",0).attr("y",H+65)
    .attr("fill","#6e6758")
    .style("font-family","'Fira Code', monospace").style("font-size","9.5px")
    .text("States with fewer than 3 qualifying counties are excluded. n = 2,010 of 3,143 counties.");

  buildDotLegend(g,W,povColor);

  registerStateListener(abbr=>{
    dots.transition().duration(200)
      .attr("r",d=>d.state===abbr?10:7)
      .attr("stroke",d=>d.state===abbr?"#1a1814":"#f5f1e8")
      .attr("stroke-width",d=>d.state===abbr?2.5:1)
      .attr("opacity",d=>abbr==="all"?1:(d.state===abbr?1:0.3));

    stateLabels
      .attr("fill",d=>abbr==="all"?"#4a4438":(d.state===abbr?"#1a1814":"#b0a894"))
      .style("font-weight",d=>d.state===abbr?"700":"500");

    resetLabel.transition().duration(200).attr("opacity",abbr==="all"?0:1);
  });
}

function buildDotLegend(g,W,colorScale){
  const lx=W+12, ly=0, lh=90;
  const defs=g.append("defs");
  const gradV=defs.append("linearGradient").attr("id","pdot-grad-v")
    .attr("x1","0%").attr("x2","0%").attr("y1","0%").attr("y2","100%");
  const[lo,hi]=colorScale.domain();
  d3.range(11).forEach(i=>{
    gradV.append("stop").attr("offset",`${i*10}%`)
      .attr("stop-color",colorScale(lo+(i/10)*(hi-lo)));
  });
  g.append("rect").attr("x",lx).attr("y",ly).attr("width",10).attr("height",lh)
    .attr("fill","url(#pdot-grad-v)").attr("rx",2);
  g.append("text").attr("x",lx+14).attr("y",ly+5)
    .attr("fill","#6e6758").style("font-family","'Fira Code', monospace").style("font-size","10px")
    .text("lower poverty");
  g.append("text").attr("x",lx+14).attr("y",ly+lh)
    .attr("fill","#6e6758").style("font-family","'Fira Code', monospace").style("font-size","10px")
    .text("higher poverty");
  g.append("text").attr("x",lx+14).attr("y",ly+lh/2+3)
    .attr("fill","#9e9788").style("font-family","'Fira Code', monospace").style("font-size","9px")
    .text("dot color =");
  g.append("text").attr("x",lx+14).attr("y",ly+lh/2+14)
    .attr("fill","#9e9788").style("font-family","'Fira Code', monospace").style("font-size","9px")
    .text("mean poverty");
}