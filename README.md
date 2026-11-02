# Raasta

**Technology, without the confusion.**

Raasta turns an everyday digital task into clear, guided steps. Users describe a task in English, Hindi, or Romanized Hinglish, then follow an interactive simulation or Universal Guidance instructions at their own pace. Raasta highlights the next control, can read instructions aloud, and offers help when a user cannot find what to click.

> **Simulation notice:** The student portal, train booking, document download, and phone settings workflows are examples. Raasta does not book tickets, make payments, download real institutional records, or change device settings.

## What is included

- Four specialised simulated workflow families: college fee receipts, train booking, institutional documents, and smartphone basics (Wi-Fi, Bluetooth, and brightness).
- Universal Guidance for selected everyday digital tasks, with local plans for common requests and device-specific clarifications where needed.
- Optional Gemini task understanding, structured response validation, and a safe local fallback for quota and transient service errors.
- Demo Mode, which bypasses Gemini and uses deterministic local classification for supported tasks.
- English browser text-to-speech, Hindi Sarvam speech with browser fallback, and optional browser speech recognition.
- Context-aware step help, natural-language navigation, Beginner/Experienced guidance, text size, high contrast, speech speed, and dark/light themes.

## Tech stack

Node.js, Express 5, plain HTML/CSS/JavaScript frontend, Google Gemini API (optional), Sarvam speech API (optional), and the Node built-in test runner.

## Requirements

- **Node.js 20 or newer** (with npm). Check with `node -v`.
- Git, to clone the repository.
- A modern browser. Speech recognition and speech output availability varies by browser and device.
- Gemini and Sarvam credentials are optional. Local workflow guides and Demo Mode do not require them.

## Run locally

```sh
git clone https://github.com/tanishqm-coder/RAASTA.git
cd RAASTA
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000). Keep the terminal open while the app is running; stop it with Ctrl+C.

Run these commands in a normal terminal (Command Prompt, PowerShell, or Terminal), not inside the Node.js prompt.

To run the automated tests:

```sh
npm test
```

### Windows PowerShell notes

- Do not run the clone inside `C:\Windows\system32`; first move to your own folder, for example `cd $HOME\Desktop`.
- If PowerShell reports that running scripts is disabled, use `npm.cmd install` and `npm.cmd start`, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

### Branches

`main` contains the current merged project, including the `feature/ai` work. To try the feature branch directly, run `git checkout feature/ai` before `npm install`.

### Port

The server listens on port 3000 by default. To use another port, set `PORT`, for example `PORT=3001 npm start` (macOS/Linux) or `$env:PORT=3001; npm start` (PowerShell).

## Using the app

1. Choose **English** or **हिन्दी**.
2. Tick **Demo Mode** under the task box for the most reliable, deterministic experience (no Gemini calls).
3. Type a task or pick an example, then choose **Guide me**. Examples only fill the task box.
4. Follow the highlighted control. Use **Previous**, **Next**, **Repeat instruction**, or **Can't find the control?** as needed.
5. Choose **Reset demo** to clear the current guide and start another task.

Example tasks:

- `Hostel fees bhar di, receipt kahan milegi?`
- `I want to book a train from Jaipur to Delhi.`
- `Mujhe Bluetooth on karna hai.`

## Configure external services (optional)

Copy `.env.example` to `.env` in the repository root and add credentials locally if you want to use Gemini task understanding or Sarvam Hindi speech. The server reads `GEMINI_API_KEY`, `GEMINI_MODEL`, `SARVAM_API_KEY`, and `PORT`. Keep `.env` private; it is ignored by Git. Never put keys in frontend files, documentation, screenshots, or logs.

Without a Gemini key, the server starts in local demo mode and uses its built-in classifier and workflow plans. The current model example is `gemini-3.8-flash`. Provider access and free-tier quotas can change; enable **Demo Mode** for a deterministic presentation without Gemini task-understanding calls. Hindi read-aloud may still contact Sarvam when configured.

## Project layout

| File | Purpose |
|---|---|
| `server.js` | Express server, Gemini and Sarvam endpoints, local fallback |
| `index.html`, `script.js`, `style.css` | Frontend and simulated workflows |
| `task-intent.js` | Local task classifier |
| `universal-guidance.js` | Universal Guidance plans |
| `*.test.js` | Automated tests (run with `npm test`) |

## Demo and project details

- See [DEMO_GUIDE.md](DEMO_GUIDE.md) for presenter setup, reset instructions, a three-minute script, troubleshooting, and judge questions.
- See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for architecture, implementation details, security boundaries, testing methodology, development challenges, and limitations.

## Privacy and safety

Do not enter real student records, passwords, payment information, or verification codes. When configured services are used, task text may be sent to Gemini and Hindi speech text may be sent to Sarvam. Speech recognition data handling depends on the browser. Universal Guidance cannot see or control the user's device. Check official instructions for model-specific or sensitive actions.
