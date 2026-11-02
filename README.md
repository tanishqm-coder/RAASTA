# Raasta

Raasta turns an everyday digital task into clear, guided steps. Users can describe tasks in English, Hindi, or Romanized Hinglish, then follow an interactive simulation or Universal Guidance instructions at their own pace.

> **Simulation notice:** The student portal, train booking, document download, and phone settings workflows are examples. Raasta does not book tickets, make payments, download real institutional records, or change device settings.

## What is included

- Four specialised simulated workflow families: college fee receipts, train booking, institutional documents, and smartphone basics (Wi-Fi, Bluetooth, and brightness).
- Universal Guidance for selected everyday digital tasks, with local plans for common requests and device-specific clarifications where needed.
- Optional Gemini task understanding, structured response validation, and a safe local fallback for quota and transient service errors.
- Demo Mode, which bypasses Gemini and uses deterministic local classification for supported tasks.
- English browser text-to-speech, Hindi Sarvam speech with browser fallback, and optional browser speech recognition.
- Context-aware step help, natural-language navigation, Beginner/Experienced guidance, text size, high contrast, speech speed, and dark/light themes.

## Requirements

- Node.js and npm.
- A modern browser for the frontend. Speech recognition and speech output availability varies by browser and device.
- Gemini and Sarvam credentials are optional. Local workflow guides and Demo Mode do not require Gemini credentials.

## Run locally

Open a terminal in the repository root and run:

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). To run the automated tests, use:

```sh
npm test
```

## Configure external services (optional)

Copy `.env.example` to `.env` in the repository root and add credentials locally if you want to use Gemini task understanding or Sarvam Hindi speech. The server reads `GEMINI_API_KEY`, `GEMINI_MODEL`, `SARVAM_API_KEY`, and `PORT`. Keep `.env` private; it is ignored by Git. Never put keys in frontend files, documentation, screenshots, or logs.

The current model example is `gemini-3.8-flash`. Provider access and free-tier quotas can change; enable **Demo Mode** for a deterministic presentation without Gemini task-understanding calls. Hindi read-aloud may still contact Sarvam when configured.

## Demo and project details

- See [DEMO_GUIDE.md](DEMO_GUIDE.md) for presenter setup, reset instructions, a three-minute script, troubleshooting, and judge questions.
- See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for architecture, implementation details, security boundaries, testing methodology, development challenges, and limitations.

## Privacy and safety

Do not enter real student records, passwords, payment information, or verification codes. When configured services are used, task text may be sent to Gemini and Hindi speech text may be sent to Sarvam. Speech recognition data handling depends on the browser. Universal Guidance cannot see or control the user's device. Check official instructions for model-specific or sensitive actions.
