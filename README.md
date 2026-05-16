<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/21ad98fc-bbe8-41b4-a589-2d15570bc0a9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Load and stress testing

1. Start the app:
   `npm run dev`
2. In another terminal, run:
   - Load test: `npm run perf:load`
   - Stress test: `npm run perf:stress`

By default tests run against `http://127.0.0.1:3000`.  
To target another URL, set `PERF_TARGET_URL`, for example:

`PERF_TARGET_URL=http://127.0.0.1:4173 npm run perf:all`
