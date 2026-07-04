# Chlorine Pool Chemistry Calculator

A single-page web app for tracking and balancing the water chemistry of a traditional (non-saltwater) chlorine pool. Enter test-kit readings and pool volume, and it tells you what's out of range and how much of each chemical to add.

## Features

- **Readings tracker** for Free Chlorine (FC), Combined Chlorine (CC), pH, Total Alkalinity (TA), Calcium Hardness (CH) / Total Hardness (TH), Cyanuric Acid (CYA), Total Dissolved Solids (TDS), and water temperature, each with an in-range / out-of-range / action-needed status badge.
- **Langelier Saturation Index (LSI)** calculation from pH, TA, calcium hardness, and water temperature, with a corrosive/balanced/scaling classification and guidance.
- **Dosing recommendations**, calculated from pool volume (gallons) and current readings:
  - Raise Free Chlorine with liquid chlorine (sodium hypochlorite) or granular shock (calcium hypochlorite), with a warning when FC is too high to dose further.
  - SLAM shock dosing when Combined Chlorine is elevated (shock level = CYA × 0.2).
  - Lower pH with muriatic acid, or raise it with soda ash.
  - Lower Total Alkalinity with muriatic acid, or raise it with baking soda.
  - Raise Calcium Hardness with calcium chloride, or flag a partial drain/refill when CH is too high.
  - Raise Cyanuric Acid (stabilizer), or flag dilution when CYA is too high.
  - Flag elevated/high TDS with a monitor or drain/refill recommendation.
- **Adjustable product concentrations** for liquid chlorine (6%, 8.25%, 10%, 12.5%), granular shock (65%, 73% cal-hypo), muriatic acid (14.5%, 31.45%, 34%), and trichlor tablets (90%, 99%) — dosing amounts recalculate accordingly.
- **Reference tab** with target ranges for a traditional chlorine pool (FC, CC, pH, TA, CH, CYA, TDS, temperature, LSI) and notes on CYA buildup, SLAM/shock thresholds, cal-hypo hardness effects, muriatic acid safety, and TDS management.
- **History log and trend charts**: log readings over time (stored in the browser's `localStorage`), view line charts per parameter with target-range bands (via Chart.js), and export/import history as a JSON file.
- **ppm / mg·L⁻¹ unit toggle** and a light/dark theme that follows the OS color scheme.

All calculations and data storage run entirely client-side — no server or network calls are made (the page's Content-Security-Policy blocks any external connections).

## Usage

Open `chlorine-pool-calculator.html` directly in a web browser. No build step or server is required.

## Tech stack

- Plain HTML, CSS, and vanilla JavaScript (`chlorine-pool-calculator.js`) — no framework, no `package.json`/build tooling.
- [Chart.js](https://www.chartjs.org/) (loaded from a CDN) for the trend charts.
- [Tabler Icons](https://tabler.io/icons) webfont (loaded from a CDN) for icons.
- Browser `localStorage` for persisting logged readings and the last dosing recommendation.
