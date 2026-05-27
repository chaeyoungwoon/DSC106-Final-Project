// stripplots.js -- larger clearer text, warm atlas palette

const STRIP_PANELS = [
  { key:"food",     label:"Food\nInsecurity",         unit:"%",     scl:v=>v*100, tstat:"t = 56.89" },
  { key:"mental",   label:"Mental\nDistress",          unit:"%",     scl:v=>v*100, tstat:"t = 42.50" },
  { key:"overdose", label:"Drug\nOverdose",            unit:"/100k", scl:v=>v,     tstat:"t = 11.90" },
  { key:"uninsured",label:"Uninsured\nChildren",       unit:"%",     scl:v=>v*100, tstat:"t = 7.96"  },
  { key:"childcare",label:"Child Care\nCost Burden",   unit:"%",     scl:v=>v*100, tstat:"t = 10.06" },
];

function lcgJitter(seed,n,spread){
  let s=seed>>>0;
  return Array.from({length:n},()=>{
    s=((s*1664525)+1013904223)>>>0;
    return (s/0xFFFFFFFF-0.5)*2*spread;
  });
}

function drawStripPlots(state){
  const wrapper=document.getElementById("strip-wrapper");
  if(!wrapper) return;
  wrapper.innerHTML="";

  const PANEL_H=430;
  const PANEL_W=174;
  const CX=88;

  STRIP_PANELS.forEach((panel,pi)=>{
    const div=document.createElement("div");
    div.className="strip-panel";
    wrapper.appendChild(div);

    const allPts=[...state.counties.values()]
      .filter(d=>d[panel.key]!==null)
      .map(d=>({...d,val:panel.scl(d[panel.key])}));
    const dbPts =allPts.filter(d=> d.doubleBurden);
    const othPts=allPts.filter(d=>!d.doubleBurden);

    const yScale=d3.scaleLinear()
      .domain([d3.min(allPts,d=>d.val)*0.94, d3.max(allPts,d=>d.val)*1.06])
      .range([PANEL_H-48, 46]);

    const svg=d3.select(div).append("svg")
      .attr("viewBox",`0 0 ${PANEL_W} ${PANEL_H}`)
      .style("width","100%").style("height",`${PANEL_H}px`).style("overflow","visible")
      .style("background","#ede9de");

    // y axis
    svg.append("g").attr("transform","translate(38,0)")
      .call(d3.axisLeft(yScale).ticks(5).tickSize(3))
      .call(a=>a.select(".domain").attr("stroke","#c8c2b0"))
      .call(a=>a.selectAll("text")
        .attr("fill","#6e6758")
        .style("font-size","9.5px")
        .style("font-family","'Fira Code', monospace"))
      .call(a=>a.selectAll("line").attr("stroke","#c8c2b0"));

    // unit label
    svg.append("text").attr("x",38).attr("y",PANEL_H-28)
      .attr("text-anchor","middle").attr("fill","#9e9788")
      .style("font-size","9px").style("font-family","'Fira Code', monospace")
      .text(panel.unit);

    const jOth=lcgJitter(pi*1000+1,othPts.length,24);
    const jDb =lcgJitter(pi*2000+1,dbPts.length, 24);

    svg.selectAll("circle.oth").data(othPts).join("circle").attr("class","oth")
      .attr("cx",(d,i)=>CX+jOth[i]).attr("cy",d=>yScale(d.val))
      .attr("r",2.4).attr("fill","#b0a894").attr("opacity",0.58)
      .on("mousemove",(ev,d)=>showTooltip(ev,d)).on("mouseleave",hideTooltip);

    svg.selectAll("circle.db").data(dbPts).join("circle").attr("class","db")
      .attr("cx",(d,i)=>CX+jDb[i]).attr("cy",d=>yScale(d.val))
      .attr("r",4).attr("fill","#a83318").attr("opacity",0.82)
      .on("mousemove",(ev,d)=>showTooltip(ev,d)).on("mouseleave",hideTooltip);

    const dbMean =d3.mean(dbPts, d=>d.val);
    const othMean=d3.mean(othPts,d=>d.val);

    svg.append("line").attr("x1",CX-18).attr("x2",CX+18)
      .attr("y1",yScale(dbMean)).attr("y2",yScale(dbMean))
      .attr("stroke","#a83318").attr("stroke-width",2.2);
    svg.append("line").attr("x1",CX-18).attr("x2",CX+18)
      .attr("y1",yScale(othMean)).attr("y2",yScale(othMean))
      .attr("stroke","#9e9788").attr("stroke-width",1.4).attr("stroke-dasharray","3,2");

    // mean value labels -- larger
    svg.append("text").attr("x",CX+22).attr("y",yScale(dbMean)+4)
      .attr("fill","#7a2210")
      .style("font-size","10px").style("font-weight","500").style("font-family","'Fira Code', monospace")
      .text(dbMean.toFixed(1));
    svg.append("text").attr("x",CX+22).attr("y",yScale(othMean)+4)
      .attr("fill","#9e9788")
      .style("font-size","10px").style("font-family","'Fira Code', monospace")
      .text(othMean.toFixed(1));

    // panel title -- larger and clearly legible
    const lines=panel.label.split("\n");
    const te=svg.append("text").attr("x",CX).attr("y",12)
      .attr("text-anchor","middle").attr("fill","#1a1814")
      .style("font-size","11px").style("font-weight","600")
      .style("font-family","'Work Sans', sans-serif");
    lines.forEach((line,li)=>{
      te.append("tspan").attr("x",CX).attr("dy",li===0?"0":"1.3em").text(line);
    });

    // t-stat
    const tY=lines.length>1?34:26;
    svg.append("text").attr("x",CX).attr("y",tY+4)
      .attr("text-anchor","middle").attr("fill","#7a2210")
      .style("font-size","9px").style("font-weight","500").style("font-family","'Fira Code', monospace")
      .text(panel.tstat+", p < .001");
  });

  const legendEl=document.getElementById("strip-legend");
  if(legendEl){
    legendEl.innerHTML=`
      <span style="display:inline-flex;align-items:center;gap:6px;margin-right:20px">
        <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#a83318" opacity="0.8"/></svg>
        Double-burden counties (n = 520)
      </span>
      <span style="display:inline-flex;align-items:center;gap:6px;margin-right:20px">
        <svg width="10" height="10"><circle cx="5" cy="5" r="3" fill="#b0a894" opacity="0.7"/></svg>
        All other counties
      </span>
      <span style="display:inline-flex;align-items:center;gap:6px;margin-right:20px">
        <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#a83318" stroke-width="2.2"/></svg>
        Mean (double-burden)
      </span>
      <span style="display:inline-flex;align-items:center;gap:6px">
        <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#9e9788" stroke-width="1.5" stroke-dasharray="4,2"/></svg>
        Mean (all other)
      </span>
    `;
  }
}
