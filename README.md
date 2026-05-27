# The Compounding Crisis
### DSC 106 Final Project

Child poverty, food insecurity, and mental distress across America's counties.

---

## Repo structure

```
index.html          main page 
css/
  style.css         all styling
js/
  main.js           data loading, shared state, event bus, tooltip
  choropleth.js     Viz 1: US county choropleth
  scatter.js        Viz 2: poverty vs food insecurity scatterplot
  racechart.js      Viz 3: race-stratified bar chart
  stripplots.js     Viz 4: small-multiple strip plots
  dotplot.js        Viz 5: state overdose dot plot
data/
  analytic_data2025_v3.csv   
figures/
  fig1_poverty_histogram.png      (from proposal)
  fig2_poverty_food_scatter.png
  fig3_race_poverty_bars.png
  fig4_correlations.png
  fig5_strip_plots.png
  fig6_double_burden_by_state.png
proposal_figures.py   original proposal static figure script
```

---

## Getting the data

The CHR 2025 CSV is too large to commit directly (796 columns, ~3k rows).

1. Download `analytic_data2025_v3.csv` from:
   https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation

2. Place it at `data/analytic_data2025_v3.csv` in the repo root.

3. Add it to `.gitignore` if you don't want to commit a 3MB CSV, OR commit it
   -- GitHub Pages will serve it fine at that size.

   If you commit it, the page loads with no CORS issues on GitHub Pages because
   the CSV and the HTML are served from the same origin.

---

## Running locally

```bash
# from the repo root -- any static file server works
python -m http.server 8000
# then open http://localhost:8000
```

Do NOT open index.html directly as a file:// URL -- d3.csv() will fail with a
CORS error when trying to load the CSV. You need a local server.

---

## How the views are linked

All five visualizations share a single event bus defined in `main.js`:

- **State filter**: selecting a state from any dropdown on the page calls
  `AppState.selectedState` and fires all registered `stateListeners`.
  Every viz module registers a listener that dims out-of-state counties/bars/dots.

- **County selection**: clicking a county on the map or a dot on the scatter
  calls `selectCounty(fips)` which fires all registered `countyListeners`.
  The map pulses the clicked county in white; the scatter highlights its dot.

- **Dot plot click**: clicking a state dot in Viz 5 sets the state filter,
  which propagates to all other views via the same bus.

---

## Data notes

- FIPS codes are left-padded to 5 digits before any join (CHR drops leading
  zeros for some states, causing silent mismatches with TopoJSON).
- Subgroup poverty estimates (by race) are suppressed by SAIPE for counties
  with small denominators. Sample sizes: Black n=1,642; AIAN n=807; White n=3,065.
- Overdose rates suppressed for <10 deaths over 2020-2022 (2,010 valid counties).
- Row 0 of the CHR CSV after the header is a description row, not data.
  `main.js` drops it by checking for empty or non-numeric FIPS.
