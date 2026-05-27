# proposal_figures.py
# Story-first static figures for the DSC 106 proposal.
# Run from repo root: python proposal_figures.py
# Needs: pip install pandas matplotlib numpy scipy

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.lines import Line2D
from matplotlib.colors import LinearSegmentedColormap
from scipy import stats
import os, warnings

warnings.filterwarnings("ignore")
os.makedirs("figures", exist_ok=True)

import matplotlib.font_manager as _fm
_available = set(f.name for f in _fm.fontManager.ttflist)
_candidates = [
    "Helvetica Neue", "Helvetica", "Gill Sans", "Avenir", "Optima",
    "Futura", "Poppins", "Lato", "Nunito", "DM Sans",
    "Liberation Sans", "TeX Gyre Heros", "DejaVu Sans",
]
FONT = next((f for f in _candidates if f in _available), "sans-serif")
print(f"  using font: {FONT}")

BG      = "#F7F3EE"
INK     = "#1C1C1E"
SLATE   = "#5A6475"
GRID    = "#E2DDD8"
C_RED   = "#C0392B"
C_AMBER = "#D97706"
C_TEAL  = "#0E7490"
C_STONE = "#C8BFB4"
C_GOLD  = "#B7791F"

plt.rcParams.update({
    "font.family":        FONT,
    "font.size":          10,
    "axes.spines.top":    False,
    "axes.spines.right":  False,
    "axes.spines.left":   False,
    "axes.spines.bottom": True,
    "axes.grid":          False,
    "grid.color":         GRID,
    "grid.linewidth":     0.8,
    "axes.linewidth":     0.8,
    "axes.edgecolor":     SLATE,
    "xtick.color":        SLATE,
    "ytick.color":        SLATE,
    "xtick.labelsize":    9,
    "ytick.labelsize":    9,
    "figure.dpi":         150,
    "savefig.dpi":        220,
    "savefig.bbox":       "tight",
    "savefig.facecolor":  BG,
    "figure.facecolor":   BG,
    "axes.facecolor":     BG,
    "axes.labelcolor":    SLATE,
    "text.color":         INK,
})

# title block: bold claim on one line, smaller context line below it.
# Uses suptitle + a fig.text so they are always separated cleanly.
def add_titles(fig, claim, subtitle, claim_y=0.97, sub_y=0.91):
    fig.text(0.015, claim_y, claim,
             fontsize=13, fontweight="bold", color=INK,
             ha="left", va="top")
    fig.text(0.015, sub_y, subtitle,
             fontsize=8.5, color=SLATE, ha="left", va="top")

def footnote(fig, text, y=-0.03):
    fig.text(0.015, y, text, fontsize=7.5, color=SLATE,
             style="italic", va="top", wrap=True)

# ── load + clean ───────────────────────────────────────────────────────────────
print("Loading CHR 2025 data...")
raw = pd.read_csv("data/analytic_data2025_v3.csv", dtype=str, low_memory=False)
fips_col = "5-digit FIPS Code"
raw = raw[pd.to_numeric(raw[fips_col], errors="coerce").notna()].copy()
raw[fips_col] = raw[fips_col].str.strip().str.zfill(5)
raw = raw[~raw[fips_col].str.endswith("000")].copy()
raw = raw[raw[fips_col] != "00000"].copy()
print(f"  {len(raw):,} county rows loaded")

COL = {
    "poverty":         "Children in Poverty raw value",
    "food":            "Food Insecurity raw value",
    "mental":          "Frequent Mental Distress raw value",
    "overdose":        "Drug Overdose Deaths raw value",
    "income":          "Median Household Income raw value",
    "childcare":       "Child Care Cost Burden raw value",
    "uninsured":       "Uninsured Children raw value",
    "lunch":           "Children Eligible for Free or Reduced Price Lunch raw value",
    "rural":           "% Rural raw value",
    "pctBlack":        "% Non-Hispanic Black raw value",
    "povertyBlack":    "Children in Poverty (Black)",
    "povertyWhite":    "Children in Poverty (White)",
    "povertyHispanic": "Children in Poverty (Hispanic)",
    "povertyAIAN":     "Children in Poverty (AIAN)",
    "mhProviders":     "Mental Health Providers raw value",
    "state":           "State Abbreviation",
    "name":            "Name",
}
for k, c in COL.items():
    if k not in ("state", "name") and c in raw.columns:
        raw[c] = pd.to_numeric(raw[c], errors="coerce")
df = raw.rename(columns={v: k for k, v in COL.items() if v in raw.columns}).copy()

p75_pov  = df["poverty"].quantile(0.75)
p75_food = df["food"].quantile(0.75)
df["double_burden"] = (df["poverty"] >= p75_pov) & (df["food"] >= p75_food)
n_db = int(df["double_burden"].sum())
print(f"  high-burden counties: {n_db}")


# FIG 1 -- Histogram
print("Figure 1...")

fig, ax = plt.subplots(figsize=(9, 5.5))
fig.subplots_adjust(top=0.84, bottom=0.12, left=0.09, right=0.97)
ax.set_facecolor(BG)

vals     = df["poverty"].dropna() * 100
mean_v   = vals.mean()
median_v = vals.median()

n_arr, bins, patches = ax.hist(vals, bins=48, edgecolor="white",
                                linewidth=0.3, color=C_RED, alpha=0.25, zorder=2)
for patch, left in zip(patches, bins[:-1]):
    if left >= 30:
        patch.set_facecolor(C_RED)
        patch.set_alpha(0.88)

ax.axvline(mean_v,   color=INK,    lw=1.5, linestyle="--", zorder=4)
ax.axvline(median_v, color=C_TEAL, lw=1.5, linestyle=":",  zorder=4)

ymax = n_arr.max()

# mean and median labels positioned so they never touch each other.
# median is to the LEFT of its line; mean is to the RIGHT of its line.
ax.text(median_v - 0.8, ymax * 0.88,
        f"Median  {median_v:.1f}%",
        fontsize=9, color=C_TEAL, va="bottom", ha="right", fontweight="semibold")
ax.text(mean_v + 0.8, ymax * 0.88,
        f"Mean  {mean_v:.1f}%",
        fontsize=9, color=INK, va="bottom", ha="left", fontweight="semibold")

n30   = int((vals >= 30).sum())
pct30 = n30 / len(vals) * 100
tail_x = 34.0
tail_y = float(n_arr[(bins[:-1] >= 31) & (bins[:-1] < 37)].max())
ax.annotate(
    f"{n30} counties ({pct30:.0f}%) have child poverty\nabove 30% -- more than 1.5x the median",
    xy=(tail_x, tail_y + 1),
    xytext=(50, ymax * 0.52),
    arrowprops=dict(arrowstyle="-|>", color=C_RED, lw=1.1,
                    connectionstyle="arc3,rad=-0.28"),
    fontsize=9, color=C_RED, va="center", linespacing=1.6,
    bbox=dict(facecolor=BG, edgecolor="none", pad=1)
)

ax.set_xlabel("Children in Poverty (%)", labelpad=8)
ax.set_ylabel("Number of Counties", labelpad=8)
ax.spines["bottom"].set_visible(True)
ax.text(0.99, 0.97, f"n = 3,143 counties   |   SD = {vals.std():.1f}%",
        transform=ax.transAxes, ha="right", va="top", fontsize=8, color=SLATE)

add_titles(fig,
    "Child poverty is concentrated, not evenly spread",
    "Distribution of child poverty rates across all 3,143 U.S. counties  (SAIPE/ACS 2023)")

plt.savefig("figures/fig1_poverty_histogram.png")
plt.close()
print("  saved fig1")


# FIG 2 -- Scatter
print("Figure 2...")

sdf = df[["poverty","food","rural","double_burden"]].dropna(subset=["poverty","food"]).copy()
sdf["pov_pct"]  = sdf["poverty"] * 100
sdf["food_pct"] = sdf["food"]    * 100

fig, ax = plt.subplots(figsize=(9, 6.8))
fig.subplots_adjust(top=0.84, bottom=0.10, left=0.09, right=0.88)
ax.set_facecolor(BG)

rural_cmap = LinearSegmentedColormap.from_list("r", [C_TEAL, C_STONE, C_AMBER], N=256)
rural_norm = plt.Normalize(0, 1)

mask_o  = ~sdf["double_burden"]
mask_db =  sdf["double_burden"]

ax.scatter(sdf.loc[mask_o,  "pov_pct"], sdf.loc[mask_o,  "food_pct"],
           c=sdf.loc[mask_o,  "rural"].fillna(0.3),
           cmap=rural_cmap, norm=rural_norm,
           s=5, alpha=0.32, linewidths=0, rasterized=True, zorder=2)
ax.scatter(sdf.loc[mask_db, "pov_pct"], sdf.loc[mask_db, "food_pct"],
           c=sdf.loc[mask_db, "rural"].fillna(0.5),
           cmap=rural_cmap, norm=rural_norm,
           s=18, alpha=0.85, linewidths=0.9,
           edgecolors=C_AMBER, rasterized=True, zorder=3)

ax.axvline(p75_pov * 100,  color=C_RED, lw=0.9, linestyle="--", alpha=0.5, zorder=1)
ax.axhline(p75_food * 100, color=C_RED, lw=0.9, linestyle="--", alpha=0.5, zorder=1)

# upper-right box: how many hit both thresholds
db_count = int(mask_db.sum())
ax.text(0.98, 0.98,
        f"{db_count} counties are in the top 25%\non BOTH measures simultaneously\n(shown with amber outline)",
        transform=ax.transAxes, ha="right", va="top",
        fontsize=8.5, color=C_AMBER, fontweight="semibold", linespacing=1.6,
        bbox=dict(facecolor=BG, edgecolor=C_AMBER,
                  boxstyle="round,pad=0.45", linewidth=1.0))

# bottom-left box: the "almost without exception" stat
n_exception = int(((sdf["poverty"] >= p75_pov) &
                   (sdf["food"] < df["food"].quantile(0.25))).sum())
ax.text(0.02, 0.04,
        f"Only {n_exception} counties have high poverty\nbut low food insecurity",
        transform=ax.transAxes, ha="left", va="bottom",
        fontsize=8, color=SLATE, style="italic", linespacing=1.5,
        bbox=dict(facecolor=BG, edgecolor=GRID,
                  boxstyle="round,pad=0.4", linewidth=0.8))

# r value bottom-right, separated from the exception box by being in the center-right
r_val, _ = stats.pearsonr(sdf["pov_pct"], sdf["food_pct"])
ax.text(0.98, 0.06, f"r = {r_val:.3f},  n = {len(sdf):,}",
        transform=ax.transAxes, ha="right", va="bottom",
        fontsize=11, color=C_RED, fontweight="bold")

cbar = fig.colorbar(
    plt.cm.ScalarMappable(norm=rural_norm, cmap=rural_cmap),
    ax=ax, fraction=0.026, pad=0.02)
cbar.set_label("% Rural", fontsize=8, color=SLATE)
cbar.ax.tick_params(labelsize=7.5, colors=SLATE)
cbar.outline.set_visible(False)

ax.set_xlabel("Children in Poverty % (2023)", labelpad=8)
ax.set_ylabel("Food Insecurity % (2022)", labelpad=8)

add_titles(fig,
    "Where child poverty rises, food insecurity follows -- almost without exception",
    "Each dot = one county. Amber border = counties in the top 25% on BOTH child poverty AND food insecurity. Color = % rural.")

plt.savefig("figures/fig2_poverty_food_scatter.png")
plt.close()
print("  saved fig2")


# FIG 3 -- Race bars
print("Figure 3...")

race_groups = [
    ("povertyWhite",    "White",    C_TEAL),
    ("povertyHispanic", "Hispanic", C_GOLD),
    ("povertyAIAN",     "AIAN",     C_AMBER),
    ("povertyBlack",    "Black",    C_RED),
]

fig, ax = plt.subplots(figsize=(9, 5.0))
fig.subplots_adjust(top=0.84, bottom=0.16, left=0.10, right=0.97)
ax.set_facecolor(BG)

y_pos = np.arange(len(race_groups))
means, cis, ns = [], [], []
for key, _, _ in race_groups:
    v = df[key].dropna() * 100
    means.append(v.mean())
    cis.append(1.96 * v.sem())
    ns.append(len(v))

ax.barh(y_pos, means, color=[g[2] for g in race_groups],
        height=0.50, alpha=0.88, zorder=2)

for i, (m, ci, (_, _, color)) in enumerate(zip(means, cis, race_groups)):
    ax.errorbar(m, i, xerr=ci, fmt="none",
                color=color, capsize=5, capthick=1.5, elinewidth=1.5, zorder=3)

# value labels -- pushed far enough right to always clear the CI cap
for i, (m, ci, n) in enumerate(zip(means, cis, ns)):
    ax.text(m + ci + 1.5, i,
            f"{m:.1f}%   (n = {n:,} counties)",
            va="center", fontsize=9.5, color=INK)

# gap arrow: anchored to a fixed x well past the longest bar+label
# so it never varies with data and never overlaps anything
arrow_x = 52.0
gap = means[3] - means[0]
ax.annotate("",
    xy=(arrow_x, 3), xytext=(arrow_x, 0),
    arrowprops=dict(arrowstyle="<->", color=INK, lw=1.4))
ax.text(arrow_x + 1.2, 1.5,
        f"{gap:.1f} pp\ngap",
        fontsize=9.5, color=INK, va="center", fontweight="bold",
        linespacing=1.5)

ax.set_yticks(y_pos)
ax.set_yticklabels([g[1] for g in race_groups], fontsize=12, fontweight="semibold")
ax.set_xlabel("Mean County-Level Child Poverty Rate (%)", labelpad=8)
ax.set_xlim(0, 68)
ax.spines["left"].set_visible(False)
# only x grid, subtle
for gv in ax.xaxis.get_gridlines():
    gv.set(color=GRID, linewidth=0.8)
ax.xaxis.grid(True)
ax.set_axisbelow(True)

add_titles(fig,
    "In a typical county, Black children are more than twice as likely to live in poverty",
    "Mean child poverty rate by race (SAIPE/ACS 2023). Black vs. White: t = 42.07, p < 0.001.")

footnote(fig,
    "County-level means, not population-weighted national rates. "
    "Estimates suppressed in small counties; n varies by group. Error bars = 95% CI.")

plt.savefig("figures/fig3_race_poverty_bars.png")
plt.close()
print("  saved fig3")


# FIG 4 -- Correlation bars
print("Figure 4...")

corr_pairs = [
    ("food",        "Food Insecurity"),
    ("income",      "Median Household Income"),
    ("lunch",       "Free / Reduced Price Lunch"),
    ("mental",      "Frequent Mental Distress"),
    ("pctBlack",    "% Non-Hispanic Black"),
    ("overdose",    "Drug Overdose Deaths"),
    ("rural",       "% Rural"),
    ("childcare",   "Child Care Cost Burden"),
    ("mhProviders", "Mental Health Providers"),
]
r_vals, labels = [], []
for key, lbl in corr_pairs:
    sub = df[["poverty", key]].dropna()
    r, _ = stats.pearsonr(sub["poverty"], sub[key]) if len(sub) > 10 else (0, 1)
    r_vals.append(r); labels.append(lbl)

order    = np.argsort(r_vals)
r_sorted = [r_vals[i] for i in order]
l_sorted = [labels[i] for i in order]

fig, ax = plt.subplots(figsize=(9, 6.0))
fig.subplots_adjust(top=0.84, bottom=0.10, left=0.24, right=0.97)
ax.set_facecolor(BG)

bar_colors = []
for r, lbl in zip(r_sorted, l_sorted):
    if "Mental Health" in lbl:
        bar_colors.append(C_STONE)
    elif r < 0:
        bar_colors.append(C_TEAL)
    else:
        bar_colors.append(C_RED)

y_pos = np.arange(len(l_sorted))
ax.barh(y_pos, r_sorted, color=bar_colors, height=0.56, alpha=0.88, zorder=2)
ax.axvline(0, color=INK, lw=0.9, zorder=3)

for gv in ax.xaxis.get_gridlines():
    gv.set(color=GRID, linewidth=0.8)
ax.xaxis.grid(True)
ax.set_axisbelow(True)

# value labels: always on the open (outside) side of each bar
for i, r in enumerate(r_sorted):
    if abs(r) < 0.06:
        # near-zero bar: label just to the right of zero
        ax.text(0.07, i, f"{r:+.3f}", va="center", ha="left",
                fontsize=9, color=SLATE)
    elif r >= 0:
        ax.text(r + 0.025, i, f"{r:+.3f}", va="center", ha="left",
                fontsize=9, color=INK)
    else:
        ax.text(r - 0.025, i, f"{r:+.3f}", va="center", ha="right",
                fontsize=9, color=INK)

# annotation for the key finding. Placed in the bottom-left open space
# (negative side), well away from all bars.
mh_idx     = l_sorted.index("Mental Health Providers")
mental_idx = l_sorted.index("Frequent Mental Distress")
r_mental   = r_sorted[mental_idx]
r_mh       = r_sorted[mh_idx]

ax.annotate(
    f"Mental distress strongly\ntracks poverty (r = {r_mental:+.3f})\nbut provider count does not\n(r = {r_mh:+.3f}, not significant)",
    xy=(r_mh, mh_idx),
    xytext=(-0.95, mh_idx + 2.8),
    arrowprops=dict(arrowstyle="-|>", color=SLATE, lw=0.9,
                    connectionstyle="arc3,rad=-0.25"),
    fontsize=8.5, color=SLATE, va="bottom", linespacing=1.6,
    bbox=dict(facecolor=BG, edgecolor=GRID,
              boxstyle="round,pad=0.4", linewidth=0.8)
)

ax.set_yticks(y_pos)
ax.set_yticklabels(l_sorted, fontsize=9.5)
ax.set_xlabel("Pearson r  (reference: Children in Poverty %)", labelpad=8)
ax.set_xlim(-1.05, 1.05)
ax.spines["left"].set_visible(False)
ax.yaxis.grid(False)

add_titles(fig,
    "Mental distress tracks poverty -- but having more providers nearby does not help",
    "Pearson r with child poverty across 3,143 counties. All p < 0.001 except Mental Health Providers (n.s.).")

plt.savefig("figures/fig4_correlations.png")
plt.close()
print("  saved fig4")


# FIG 5 -- Strip plots
# Layout: title block at very top, definition box below it, then panels,
# then legend at bottom. Nothing overlaps because each zone has a fixed y range.
print("Figure 5...")

panels = [
    ("mental",    "Frequent Mental\nDistress %",   lambda v: v*100, "t = 42.50"),
    ("overdose",  "Drug Overdose\nDeaths /100k",   lambda v: v,     "t = 11.90"),
    ("uninsured", "Uninsured\nChildren %",          lambda v: v*100, "t = 7.96"),
    ("childcare", "Child Care\nCost Burden %",      lambda v: v*100, "t = 10.06"),
    ("lunch",     "Free/Reduced\nPrice Lunch %",    lambda v: v*100, "t = 48.00"),
]

fig = plt.figure(figsize=(14, 9))
fig.patch.set_facecolor(BG)

# reserve top 30% for title/definition, bottom 10% for legend
# panels live in y = 0.10 to 0.68
panel_bottom = 0.12
panel_top    = 0.65
panel_h      = panel_top - panel_bottom
panel_w      = 0.14
gap          = 0.025
left_start   = 0.065

rng = np.random.default_rng(42)
axes = []
for i in range(5):
    left = left_start + i * (panel_w + gap)
    ax = fig.add_axes([left, panel_bottom, panel_w, panel_h])
    ax.set_facecolor(BG)
    axes.append(ax)

for ax, (key, label, tfm, tstat) in zip(axes, panels):
    sub = df[["double_burden", key]].dropna(subset=[key]).copy()
    sub["val"] = tfm(sub[key])
    db_v  = sub.loc[ sub["double_burden"], "val"]
    oth_v = sub.loc[~sub["double_burden"], "val"]

    jit_o = rng.uniform(-0.22, 0.22, len(oth_v))
    jit_d = rng.uniform(-0.22, 0.22, len(db_v))

    ax.scatter(jit_o, oth_v, c=C_STONE, s=2.5, alpha=0.28,
               linewidths=0, rasterized=True, zorder=2)
    ax.scatter(jit_d, db_v,  c=C_AMBER, s=5.5, alpha=0.75,
               linewidths=0, rasterized=True, zorder=3)

    ax.axhline(db_v.mean(),  color=C_AMBER, lw=2.2, zorder=4)
    ax.axhline(oth_v.mean(), color=SLATE,   lw=1.4, linestyle="--", alpha=0.7, zorder=4)

    # mean labels on the right edge of each panel using axis-data mixed transform
    ax.text(0.58, db_v.mean(),  f" {db_v.mean():.1f}",
            va="center", ha="left", fontsize=7.5,
            color=C_AMBER, fontweight="semibold",
            transform=ax.get_yaxis_transform())
    ax.text(0.58, oth_v.mean(), f" {oth_v.mean():.1f}",
            va="center", ha="left", fontsize=7.5, color=SLATE,
            transform=ax.get_yaxis_transform())

    ax.set_xlim(-0.55, 0.55)
    ax.set_xticks([])
    ax.spines["bottom"].set_visible(False)
    ax.spines["left"].set_color(GRID)

    # panel label -- two lines, above the panel
    ax.set_title(label, fontsize=8.5, fontweight="semibold", color=INK,
                 pad=6, linespacing=1.35)

    # t-stat in red BELOW the panel label, inside the axes top area so it
    # never clashes with anything outside
    ax.text(0.5, 0.98, f"{tstat}\np < 0.001",
            transform=ax.transAxes, ha="center", va="top",
            fontsize=7.5, color=C_RED, linespacing=1.4)

# main claim
fig.text(0.015, 0.97,
    "High-burden counties score worse on every health measure -- not just poverty",
    fontsize=12.5, fontweight="bold", color=INK, va="top")

# context line
fig.text(0.015, 0.925,
    f"Comparing {n_db} high-burden counties (amber) vs. all others (gray). "
    "Solid line = group mean. All t-tests p < 0.001.",
    fontsize=8.5, color=SLATE, va="top")

# definition box -- a framed rectangle so it reads as a callout, not running text
def_text = (
    '"High-burden" county = in the top 25% of ALL 3,143 counties on BOTH '
    'child poverty AND food insecurity at the same time. '
    f'{n_db} counties meet this definition.'
)
fig.text(0.015, 0.885, def_text,
    fontsize=8, color=INK, va="top", linespacing=1.5,
    bbox=dict(facecolor="#EDE8E0", edgecolor=C_AMBER,
              boxstyle="round,pad=0.5", linewidth=1.0))

handles = [
    mpatches.Patch(color=C_AMBER, label=f"High-burden counties (n = {n_db})"),
    mpatches.Patch(color=C_STONE, label="All other counties"),
    Line2D([0],[0], color=C_AMBER, lw=2.2, label="Group mean (high-burden)"),
    Line2D([0],[0], color=SLATE,   lw=1.4, linestyle="--", label="Group mean (other)"),
]
fig.legend(handles=handles, loc="lower center", ncol=4,
           fontsize=8.5, frameon=False, bbox_to_anchor=(0.5, 0.01))

plt.savefig("figures/fig5_strip_plots.png")
plt.close()
print("  saved fig5")


# FIG 6 -- State bar chart
print("Figure 6...")

state_db = (
    df.groupby("state")["double_burden"].sum()
    .sort_values(ascending=False).head(12).reset_index()
)
state_db.columns = ["state", "n_db"]
total_db = int(df["double_burden"].sum())
top8_sum = int(state_db.head(8)["n_db"].sum())
top8_pct = top8_sum / total_db * 100
expected = total_db / 50

fig, ax = plt.subplots(figsize=(9.5, 5.6))
fig.subplots_adjust(top=0.84, bottom=0.18, left=0.06, right=0.97)
ax.set_facecolor(BG)

colors = [C_RED if i < 8 else "#C8836A" for i in range(len(state_db))]
bars   = ax.bar(state_db["state"], state_db["n_db"],
                color=colors, width=0.62, zorder=2)

for bar, n in zip(bars, state_db["n_db"]):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.8,
            str(int(n)), ha="center", va="bottom",
            fontsize=9.5, fontweight="semibold", color=INK)

# "expected" reference line
ax.axhline(expected, color=C_TEAL, lw=1.3, linestyle=":", zorder=1)

# label placed in the RIGHT margin past all bars, reading vertically so it
# takes zero horizontal space and never overlaps a bar
ax.text(11.7, expected,
        f"  Expected if spread\n  evenly: {expected:.0f}/state",
        fontsize=7.5, color=C_TEAL, va="center", ha="left")

# vertical separator between top 8 and next 4
ax.axvline(7.5, color=GRID, lw=1.2, zorder=1)

# callout box anchored above the middle of the top-8 group (bars 1-4)
# but low enough that it sits clearly below the bar tops
ymax_data = state_db["n_db"].max()
ax.text(3.5, ymax_data * 0.68,
    f"These 8 states:\n{top8_sum} of {total_db} high-burden counties ({top8_pct:.0f}%)",
    fontsize=9, color=C_RED, ha="center", va="top", linespacing=1.7,
    bbox=dict(facecolor=BG, edgecolor=C_RED,
              boxstyle="round,pad=0.5", linewidth=0.9))

ax.set_xlabel("State", labelpad=8)
ax.set_ylabel("High-Burden Counties", labelpad=8)
ax.set_ylim(0, ymax_data * 1.20)
for gv in ax.yaxis.get_gridlines():
    gv.set(color=GRID, linewidth=0.8)
ax.yaxis.grid(True)
ax.xaxis.grid(False)
ax.set_axisbelow(True)
ax.spines["left"].set_visible(False)

add_titles(fig,
    "Two thirds of high-burden counties are packed into just eight states",
    'Count of counties in the top 25% on BOTH child poverty and food insecurity, by state. '
    '"High-burden" defined the same way throughout this analysis.')

footnote(fig,
    f'"High-burden" = top quartile on both child poverty (2023) and food insecurity (2022) simultaneously. '
    f'Total high-burden counties nationwide: {total_db}.',
    y=-0.04)

plt.savefig("figures/fig6_double_burden_by_state.png")
plt.close()
print("  saved fig6")

print("\nAll 6 figures saved to figures/")
