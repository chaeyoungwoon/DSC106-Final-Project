// main.js
// Data loading, shared state, event bus, tooltip, and page-level enhancements:
//   - animated stat counter on load
//   - scroll-triggered section reveals
//   - active nav link highlighting
//   - county search box

const CSV_PATH  = "data/analytic_data2025_v3.csv";
const TOPO_PATH = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

const COL = {
  fips:"5-digit FIPS Code", name:"Name", state:"State Abbreviation",
  poverty:"Children in Poverty raw value", food:"Food Insecurity raw value",
  mental:"Frequent Mental Distress raw value", overdose:"Drug Overdose Deaths raw value",
  income:"Median Household Income raw value", childcare:"Child Care Cost Burden raw value",
  uninsured:"Uninsured Children raw value",
  lunch:"Children Eligible for Free or Reduced Price Lunch raw value",
  rural:"% Rural raw value", pctBlack:"% Non-Hispanic Black raw value",
  pBlack:"Children in Poverty (Black)", pWhite:"Children in Poverty (White)",
  pHispanic:"Children in Poverty (Hispanic)", pAIAN:"Children in Poverty (AIAN)",
  mhProv:"Mental Health Providers raw value",
};

window.AppState = {
  counties:new Map(), topo:null,
  poverty75:0, food75:0,
  selectedFips:null, selectedState:"all",
};

window.STATE_NAMES = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",
  KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",
  MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",
  MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",
  NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",
  ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",
  RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",
  TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",
  WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia"
};

// ---- EVENT BUS ----
const _stateListeners=[], _countyListeners=[];
window.registerStateListener  = fn => _stateListeners.push(fn);
window.registerCountyListener = fn => _countyListeners.push(fn);

window.fireStateChange = function(abbr) {
  AppState.selectedState = abbr;
  document.querySelectorAll(".state-select").forEach(s=>{ s.value=abbr; });
  const label = abbr==="all" ? "" : `Filtered: ${STATE_NAMES[abbr]||abbr}`;
  document.querySelectorAll(".linked-state-banner").forEach(el=>{ el.textContent=label; });
  _stateListeners.forEach(fn=>fn(abbr));
};

window.fireCountySelect = function(fips) {
  AppState.selectedFips = fips;
  _countyListeners.forEach(fn=>fn(fips));
};

// ---- TOOLTIP ----
window.showTooltip = function(event, d) {
  if (!d) return;
  const pct = v => (v===null||v===undefined)?"N/A":(v*100).toFixed(1)+"%";
  const per = v => (v===null||v===undefined)?"N/A":v.toFixed(1)+" /100k";
  document.getElementById("tt-name").textContent     = `${d.name}, ${d.state}`;
  document.getElementById("tt-poverty").textContent  = pct(d.poverty);
  document.getElementById("tt-food").textContent     = pct(d.food);
  document.getElementById("tt-mental").textContent   = pct(d.mental);
  document.getElementById("tt-drug").textContent     = per(d.overdose);
  document.getElementById("tt-badge").style.display  = d.doubleBurden?"inline-block":"none";
  const x=Math.min(event.clientX+16,window.innerWidth-300);
  const y=Math.min(event.clientY+16,window.innerHeight-190);
  const tt=document.getElementById("tooltip");
  tt.style.left=x+"px"; tt.style.top=y+"px";
  tt.classList.add("visible");
};
window.hideTooltip = function() {
  document.getElementById("tooltip").classList.remove("visible");
};

// ---- LOAD ----
Promise.all([d3.json(TOPO_PATH), d3.csv(CSV_PATH)])
  .then(([topo,csv])=>{
    AppState.topo=topo;
    parseCSV(csv);
    computeDerived();
    buildDropdowns();
    buildSearch();
    document.querySelectorAll(".viz-loading").forEach(el=>el.remove());
    drawChoropleth(AppState);
    drawScatter(AppState);
    drawRaceChart(AppState);
    drawStripPlots(AppState);
    drawDotPlot(AppState);
    animateStatCounters();
    initScrollReveal();
    initActiveNav();
  })
  .catch(err=>{
    console.error("Load error:",err);
    document.querySelectorAll(".viz-loading").forEach(el=>{
      el.textContent="Data unavailable. Put analytic_data2025_v3.csv in data/ and serve with a local HTTP server.";
    });
  });

function parseCSV(csv){
  const num=(row,col)=>{const v=parseFloat(row[col]);return isNaN(v)?null:v;};
  csv.forEach(row=>{
    const rawFips=(row[COL.fips]||"").trim();
    if(!rawFips) return;
    const fips=rawFips.padStart(5,"0");
    if(fips.endsWith("000")||fips==="00000") return;
    AppState.counties.set(fips,{
      fips,
      name:(row[COL.name]||"").trim(),
      state:(row[COL.state]||"").trim(),
      poverty:num(row,COL.poverty),   food:num(row,COL.food),
      mental:num(row,COL.mental),     overdose:num(row,COL.overdose),
      income:num(row,COL.income),     childcare:num(row,COL.childcare),
      uninsured:num(row,COL.uninsured),lunch:num(row,COL.lunch),
      rural:num(row,COL.rural),       pctBlack:num(row,COL.pctBlack),
      pBlack:num(row,COL.pBlack),     pWhite:num(row,COL.pWhite),
      pHispanic:num(row,COL.pHispanic),pAIAN:num(row,COL.pAIAN),
      mhProv:num(row,COL.mhProv),
    });
  });
  console.log("Counties loaded:",AppState.counties.size);
}

function computeDerived(){
  const sorted=k=>[...AppState.counties.values()].map(d=>d[k]).filter(v=>v!==null).sort(d3.ascending);
  AppState.poverty75=d3.quantile(sorted("poverty"),0.75);
  AppState.food75   =d3.quantile(sorted("food"),   0.75);
  let ndb=0;
  AppState.counties.forEach(d=>{
    d.doubleBurden=d.poverty!==null&&d.food!==null
      &&d.poverty>=AppState.poverty75&&d.food>=AppState.food75;
    if(d.doubleBurden) ndb++;
  });
  console.log("Double-burden:",ndb);
}

function buildDropdowns(){
  const states=[...new Set([...AppState.counties.values()].map(d=>d.state))].filter(Boolean).sort();
  document.querySelectorAll(".state-select").forEach(sel=>{
    while(sel.options.length>1) sel.remove(1);
    states.forEach(abbr=>{
      const opt=document.createElement("option");
      opt.value=abbr; opt.textContent=STATE_NAMES[abbr]||abbr;
      sel.appendChild(opt);
    });
    sel.addEventListener("change",()=>fireStateChange(sel.value));
  });
}

// ---- COUNTY SEARCH ----
function buildSearch(){
  const box=document.getElementById("county-search");
  const results=document.getElementById("search-results");
  if(!box||!results) return;

  const allCounties=[...AppState.counties.values()]
    .filter(d=>d.name&&d.state)
    .sort((a,b)=>a.name.localeCompare(b.name));

  box.addEventListener("input",()=>{
    const q=box.value.trim().toLowerCase();
    results.innerHTML="";
    if(q.length<2){results.style.display="none";return;}
    const hits=allCounties.filter(d=>
      d.name.toLowerCase().includes(q)||
      (STATE_NAMES[d.state]||"").toLowerCase().includes(q)
    ).slice(0,8);
    if(!hits.length){results.style.display="none";return;}
    hits.forEach(d=>{
      const li=document.createElement("li");
      li.textContent=`${d.name}, ${STATE_NAMES[d.state]||d.state}`;
      li.addEventListener("mousedown",()=>{
        box.value=`${d.name}, ${STATE_NAMES[d.state]||d.state}`;
        results.style.display="none";
        // Filter to the county state first so the dot is visible in scatter,
        // then highlight the specific county with a selection ring
        fireStateChange(d.state);
        fireCountySelect(d.fips);
        document.getElementById("section-scatter")
          ?.scrollIntoView({behavior:"smooth",block:"start"});
      });
      results.appendChild(li);
    });
    results.style.display="block";
  });

  box.addEventListener("blur",()=>{
    setTimeout(()=>{results.style.display="none";},150);
  });
}

// ---- ANIMATED STAT COUNTERS ----
// Each .stat-num animates from 0 to its target value on page load
function animateStatCounters(){
  document.querySelectorAll(".stat-num[data-target]").forEach(el=>{
    const target=parseFloat(el.dataset.target);
    const prefix=el.dataset.prefix||"";
    const suffix=el.dataset.suffix||"";
    const decimals=el.dataset.decimals?parseInt(el.dataset.decimals):0;
    let start=null;
    const duration=1400;
    function step(ts){
      if(!start) start=ts;
      const progress=Math.min((ts-start)/duration,1);
      // ease out cubic
      const eased=1-Math.pow(1-progress,3);
      const val=eased*target;
      el.textContent=prefix+val.toFixed(decimals)+suffix;
      if(progress<1) requestAnimationFrame(step);
      else el.textContent=prefix+target.toFixed(decimals)+suffix;
    }
    requestAnimationFrame(step);
  });
}

// ---- SCROLL REVEAL ----
// Sections fade+slide up when they enter the viewport
function initScrollReveal(){
  const sections=document.querySelectorAll(".viz-section, .writeup-section");
  sections.forEach(s=>{
    s.style.opacity="0";
    s.style.transform="translateY(28px)";
    s.style.transition="opacity 0.55s ease, transform 0.55s ease";
  });
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.style.opacity="1";
        e.target.style.transform="translateY(0)";
        io.unobserve(e.target);
      }
    });
  },{threshold:0.07});
  sections.forEach(s=>io.observe(s));
}

// ---- ACTIVE NAV ----
// Highlights the nav link for the section currently in view
function initActiveNav(){
  const sections=["section-map","section-scatter","section-race","section-strip","section-dotplot","section-writeup"];
  const links=document.querySelectorAll(".nav-links a");
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        links.forEach(l=>l.classList.remove("active"));
        const link=document.querySelector(`.nav-links a[href="#${e.target.id}"]`);
        if(link) link.classList.add("active");
      }
    });
  },{threshold:0.3});
  sections.forEach(id=>{
    const el=document.getElementById(id);
    if(el) io.observe(el);
  });
}