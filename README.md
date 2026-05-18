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
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## QA Notes

Use the npm lockfile in this repository. The available scripts are `dev`, `build`, `preview`, `clean`, and `lint`.

Recommended local commands:

1. Install: `npm install`
2. Develop: `npm run dev`
3. Build: `npm run build`
4. Type check: `npm run lint`

Firebase setup:

1. Copy [.env.example](.env.example) to a local env file for your workspace.
2. Point the Firebase values at a test project only.
3. Do not use production Firebase credentials or production records for local QA.

Troubleshooting:

1. If Firebase auth or Firestore calls fail, verify the env values and the rules in [firestore.rules](firestore.rules).
2. If the browser reports a favicon 404, verify [index.html](index.html) and [public/favicon.svg](public/favicon.svg).
3. If CI fails on a missing script, add that script to `package.json` or let the workflow skip it.
