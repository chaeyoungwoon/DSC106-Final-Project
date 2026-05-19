# The Compounding Crisis
### Child Poverty, Food Insecurity, and Mental Distress Across America's Counties
**DSC 106 Final Project** | County Health Rankings & Roadmaps 2025

---

## Setup

### 1. Get the data

Download the CHR 2025 analytic CSV from:
https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation

The file is called `analytic_data2025_v3.csv`. Place it in the `data/` folder:

```
data/analytic_data2025_v3.csv
```

The file is not included in the repo because it is ~35MB and the CHR terms ask you to download it directly from their site.

### 2. Serve locally

You need a local server because browsers block `file://` fetch requests for CSVs.
The easiest option:

```bash
# Python 3
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

Alternatively use the Live Server extension in VSCode (right-click index.html > "Open with Live Server").

### 3. GitHub Pages

Push to your main branch. In repo Settings > Pages, set source to `main` / `root`. The site will be live at `https://<username>.github.io/<repo-name>/`.

The CSV must be committed to `data/` for GitHub Pages to serve it. If the file is too large for GitHub's 100MB limit, use Git LFS or host the CSV somewhere else and update the `d3.csv(...)` path in `js/dataLoader.js`.

---

## File Structure

```
index.html              main page and narrative shell
css/
  style.css             all styles
js/
  state.js              shared filter state for linked brushing
  dataLoader.js         fetches + parses the CHR CSV once
  viz1_map.js           choropleth map
  viz2_scatter.js       poverty vs food insecurity scatter
  viz3_race.js          race-stratified bar chart
  viz4_strips.js        small multiple strip plots
  viz5_overdose.js      state-level overdose dot plot
  main.js               boots everything after data loads
data/
  analytic_data2025_v3.csv   (download separately, see above)
README.md
```

---

## How Linked Brushing Works

`js/state.js` holds a single `State` object that all viz files share.
When a user selects a state in the scatter dropdown or clicks a state dot in the overdose plot,
that viz calls `State.set({ selectedState: "TX" })`.
All other viz files subscribe via `State.subscribe(fn)` and react accordingly.
This keeps the visualizations coordinated without any one viz knowing about the others directly.

---

## Variables Used

All from `analytic_data2025_v3.csv`:

| Variable | Column | Source | Year |
|---|---|---|---|
| Children in Poverty % | `Children in Poverty raw value` | SAIPE/ACS | 2023 |
| Food Insecurity % | `Food Insecurity raw value` | Feeding America | 2022 |
| Frequent Mental Distress % | `Frequent Mental Distress raw value` | BRFSS | 2022 |
| Drug Overdose Deaths /100k | `Drug Overdose Deaths raw value` | NCHS | 2020-22 |
| Child Care Cost Burden % | `Child Care Cost Burden raw value` | Living Wage/SAIPE | 2024 |
| Uninsured Children % | `Uninsured Children raw value` | SAHIE | 2022 |
| % Rural | `% Rural raw value` | Decennial Census | 2020 |
| Children in Poverty (Black/White/Hispanic/AIAN) | subgroup columns | SAIPE/ACS | 2023 |

---

## Team

*[Insert team member names]*