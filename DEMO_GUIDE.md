# Raasta — Hackathon Demo Guide

## What Raasta does

Raasta turns a digital task described in everyday language into clear, step-by-step guidance. It highlights the next control in a simulated portal or phone screen and lets the user move at their own pace, ask for help, or hear the instruction. The current app demonstrates four simulated workflows; it does not connect to real student portals, railway booking, document stores, or phone settings.

## The problem and who it helps

Many people can describe what they want to do but are unsure which screen or button to use, especially when interfaces are unfamiliar or instructions are only in English. Raasta is designed for beginners and people who benefit from visual, spoken, bilingual guidance, including Hindi and Hinglish speakers. Its guides are also useful for anyone who wants a slower, more supported path through a digital task.

## How to use Raasta

1. Choose **English** or **हिन्दी** in the interface language menu. This controls the interface and guide language; Romanized Hinglish requests are also understood by the task classifier.
2. Type a task, or choose one of the homepage examples to fill the task box. Examples do not submit automatically; choose **Guide me** to start. Voice input is optional.
3. Follow the step title and instruction. Raasta highlights the relevant control in the simulator. Use **Previous**, **Next**, **Repeat instruction**, **Can't find the control?**, or the task box's **Ask Raasta** control as needed.
4. Read the completion message. It describes a simulation, not a real-world action.

The four workflow families are:

- **College fee receipt:** open Documents, choose Fee Receipts, and finish the simulated receipt flow.
- **Train booking:** enter or confirm route and date, search sample trains, choose a train, review demo passenger details, and finish the simulated booking.
- **Document download:** choose a category and sample document, review it, and finish the simulated download.
- **Smartphone basics:** follow the Wi-Fi, brightness, or Bluetooth tutorial in the simulated phone settings.

For a general smartphone request, Raasta presents a tutorial choice. A task that is unclear or outside these supported guides gets a clarification or a safe unsupported-task response.

## Start the application

Open a terminal in the repository root and run:

```sh
npm install   # first setup only
npm start
```

Open [http://localhost:3000](http://localhost:3000) in a browser. Keep the terminal open while presenting. For a quick pre-demo check, run `npm test` from the same project directory.

## Use deterministic Demo Mode

1. On the homepage, turn on the **Demo Mode** checkbox below the task box.
2. Confirm the status says that local guides are active and Gemini will not be called.
3. Enter a supported task or click an example, then select **Guide me**.

Demo Mode sends the task to Raasta's local backend and uses the existing local intent classifier and workflow plans. It makes no Gemini task-understanding request. The selection is remembered for the current browser session. Turn the checkbox off to use Gemini when configured; the normal safe local fallback still applies to temporary Gemini failures and quota exhaustion.

### Reset between workflows

Scroll back to the task box if needed and choose **Reset demo**. This clears the active guide, progress, highlights, task text, pending task request, microphone listening, and speech playback, then returns focus to the task input. It preserves the selected language, Demo Mode, accessibility settings, and Beginner/Experienced preference. Reset does not undo or perform any real-world action because the workflows are simulations.

## If a service or device is unavailable

- **Gemini or quota:** Turn on Demo Mode before presenting. It bypasses Gemini and uses deterministic local classification for supported workflows. Temporary Gemini failures also fall back to local plans, but a permanent configuration error is reported; switching on Demo Mode avoids that dependency.
- **Microphone:** Voice recognition depends on browser support and microphone permission. If the Speak control reports an unavailable browser, denied permission, or missing microphone, type the same request in the task box. Text entry is a complete alternative.
- **Sarvam Hindi speech:** Hindi Read Aloud uses the backend Sarvam service when configured. If that service fails, Raasta tries the browser's Hindi speech voice. If no Hindi voice is available, continue using the visible instruction and highlighted control. English speech uses browser speech synthesis.
- **Speech generally:** Read-aloud is optional. The step text and navigation remain on screen, so a missing speech service does not block the guide.

## Three-minute live presentation script

The timings below total about 2 minutes 55 seconds. Keep the browser open at the homepage, turn on Demo Mode, and leave it on between workflows. Use **Reset demo** between journeys.

### Opening — 0:00–0:20

**Say:** “Digital services can be hard to use when you do not know which screen or button comes next. Raasta turns a task described in everyday language into visual, step-by-step guidance, with Hindi and English support. Today I’ll show three examples; every action you’ll see is simulated.”

### 1. Fee receipt in Hindi/Hinglish — 0:20–1:00

1. Select **हिन्दी** in the language menu. If the page is scrolled down, return to the homepage task box.
2. Enter: **“Hostel fees bhar di, receipt kahan milegi?”**
3. Select **Guide me**. The local guide should show the Documents step and a highlighted control.
4. Choose **Can't find the control?** to show contextual help for the current highlighted button. Use **Next** or click the highlighted button to continue through Documents and Fee Receipts.
5. On the final step, click the highlighted **Download Receipt** control. Point out the completion text: no file was actually downloaded.

**Say:** “Raasta understands the Hinglish request and tells us where to look. This receipt is a sample in the demo portal, not a real student record.”

Choose **Reset demo** before the next workflow; keep Demo Mode on.

### 2. Train booking in English — 1:00–1:50

1. Select **English** and enter: **“I want to book a train from Jaipur to Delhi.”**
2. Select **Guide me**. Walk through the route fields, travel date, sample search, train choice, demo passenger details, and review. The route and sample values may already be filled; confirm them rather than entering real personal information.
3. At one step, select **Repeat instruction** to demonstrate read-aloud. If audio is unavailable, point to the same visible instruction.
4. On the confirmation screen, choose the finish control and point out that no ticket was reserved and no payment was taken.

**Say:** “This teaches the shape of a booking journey using sample data. Raasta does not connect to a railway service or book a ticket.”

Choose **Reset demo** before the next workflow; keep Demo Mode on.

### 3. Bluetooth tutorial in Hindi — 1:50–2:30

1. Select **हिन्दी** and enter: **“Mujhe Bluetooth on karna hai.”**
2. Select **Guide me**. Follow the simulated Settings, Bluetooth, and toggle steps. Use **Can't find the control?** once, then continue with the highlighted controls.
3. Finish the tutorial and point out the disclosure that the real phone setting was not changed.

**Say:** “Raasta applies the same guidance pattern to a phone tutorial, but the screen is only a simulation. It never changes this device’s Bluetooth setting.”

### Optional accessibility mode — 2:30–2:35

If time permits, scroll to **Accessibility settings** and briefly show **Beginner (detailed)** versus **Experienced (concise)**, or one text-size/high-contrast control. Do not spend time changing several settings.

### Closing — 2:35–3:00

**Say:** “Raasta bridges the gap between asking for help and knowing what to do next. It combines natural-language task understanding with highlighted controls, bilingual guidance, and a deterministic demo path. The next step toward a product would be careful user testing and secure integrations with real services—with consent and clear safeguards.”

## Likely judge questions

**1. Why is Raasta needed?**

People can know their goal but still get stuck navigating unfamiliar digital interfaces. Raasta makes the next action visible and explainable.

**2. How is it different from a normal chatbot?**

It pairs task understanding with ordered steps, a highlighted simulated control, Previous/Next navigation, repeat guidance, and contextual help. A chatbot response alone does not provide that guided interaction.

**3. How does task understanding work?**

With Demo Mode on, a local classifier recognizes the supported task families and selects their existing workflow plans. With Demo Mode off and Gemini configured, the backend requests structured task output and validates it against the workflow’s allowed target sequence.

**4. Why use Gemini?**

Gemini can interpret varied natural-language requests and return structured task plans. The backend keeps the key private and validates generated targets; Gemini is optional for the deterministic demo.

**5. What happens if Gemini is unavailable or its quota is exhausted?**

Temporary failures and quota exhaustion use the safe local classifier and plans. Demo Mode avoids the Gemini call entirely. Permanent configuration errors are reported instead of silently presented as a successful AI result.

**6. How does Hindi voice support work?**

English Read Aloud uses browser speech synthesis. Hindi Read Aloud calls the backend Sarvam speech endpoint when configured and falls back to a browser Hindi voice if needed. Actual voice quality and availability depend on the service and browser.

**7. How is accessibility handled?**

The app includes text-size and high-contrast controls, speech-speed control, repeat guidance, keyboard focus styling, progress/status announcements, Beginner/Experienced modes, and visible highlighted targets. These are useful accessibility supports, not a claim of full accessibility compliance.

**8. Does Raasta really book a train or download documents?**

No. Train booking, fee receipt, and document journeys use sample data and clearly disclose that no real booking, payment, or institutional download occurred.

**9. Does the Bluetooth tutorial change my phone?**

No. It changes only state inside the simulated phone screen; the real device is untouched.

**10. What are the current limitations?**

The app demonstrates four specialised workflow families plus selected Universal Guidance tasks; it is not connected to real portals, trains, or device settings. Universal Guidance does not see the user's screen or highlight real controls. Local task coverage is limited, so unfamiliar requests may need clarification. Microphone recognition and speech services depend on the browser and configured APIs.

**11. Is Demo Mode completely offline?**

It prevents Gemini task-understanding calls and uses the local classifier, but it is not a guarantee that every feature is offline. Hindi Read Aloud may contact Sarvam, and browser speech recognition may rely on browser-provided services.

**12. What happens to task text and personal data?**

The sample workflows need no real personal details; use only fictional/demo values. With Demo Mode off, task text may be sent from the backend to Gemini. Hindi Read Aloud sends the spoken instruction text to Sarvam when that service is used. Browser microphone processing depends on the browser. Do not enter passwords, payment details, or real student records in this demo.

**13. Are API keys exposed in the browser?**

The Gemini and Sarvam integrations are server-side; their keys are read by the backend, not placed in frontend JavaScript. The demo should still use fictional task data and a properly protected local environment.

**14. What would make this a real product?**

Work with institutions and service providers on consent-based, secure integrations; test the guides with the people they are meant to help; and add privacy, authentication, reliability, and accessibility reviews before any real action is enabled.

**15. What would the team build next?**

The next sensible step is user testing across language and accessibility needs, followed by carefully scoped integrations with one partner service. Real actions should require explicit confirmation and show exactly what will happen.

## Presenter reminders

- Turn on Demo Mode before the first task and check its visible status.
- Examples fill the task box; they do not start the guide until **Guide me** is selected.
- Use fictional/sample values only. Do not enter credentials, payment data, or real student information.
- Keep the simulation disclosures visible when showing completion.
- Do not describe this as fully offline, fully accessible, or connected to real booking/document services.
