// =================================
// RAASTA - MAIN JAVASCRIPT
// =================================


// Get HTML elements

const taskInput = document.getElementById("taskInput");
const startBtn = document.getElementById("startBtn");
const voiceBtn = document.getElementById("voiceBtn");
const language = document.getElementById("language");
let resumeGuideAtStep = 0;
let activeRecognition = null;
const speechPlayback = { audio: null, objectUrl: null, controller: null, requestId: 0, button: null };
let speechSpeed = 1;
let accessibilityTextSize = "normal";
let highContrastEnabled = false;
let guidanceMode = "beginner";
let activeGuidance = null;
let demoModeEnabled = false;
let activeTaskController = null;
let taskRequestId = 0;
const themeToggle = document.getElementById("themeToggle");

function initialThemePreference() {
    try {
        const savedTheme = localStorage.getItem("raasta:theme");
        if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
    } catch { /* A restricted storage context still gets a usable theme. */ }
    const systemPreference = window.matchMedia?.("(prefers-color-scheme: dark)");
    return systemPreference ? (systemPreference.matches ? "dark" : "light") : "dark";
}

let currentTheme = initialThemePreference();

function updateThemeToggleLabel() {
    const isHindi = language.value === "hi";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    themeToggle.setAttribute("aria-label", isHindi
        ? (nextTheme === "light" ? "हल्की थीम चालू करें" : "गहरी थीम चालू करें")
        : `Switch to ${nextTheme} theme`);
    themeToggle.setAttribute("aria-pressed", String(currentTheme === "dark"));
    themeToggle.dataset.theme = currentTheme;
    document.getElementById("themeToggleLabel").textContent = currentTheme === "dark"
        ? (isHindi ? "गहरी" : "Dark")
        : (isHindi ? "हल्की" : "Light");
    document.getElementById("themeIcon").textContent = currentTheme === "dark" ? "☾" : "☼";
}

function applyTheme(theme, persist = false) {
    currentTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    updateThemeToggleLabel();
    if (persist) {
        try { localStorage.setItem("raasta:theme", currentTheme); } catch { /* Theme still applies for this page view. */ }
    }
}

function readSessionSetting(key, fallback) {
    try { return sessionStorage.getItem(`raasta:${key}`) ?? fallback; } catch { return fallback; }
}

function writeSessionSetting(key, value) {
    try { sessionStorage.setItem(`raasta:${key}`, String(value)); } catch { /* Settings still work for this page view. */ }
}

function setVoiceButtonLabel(listening = false, isHindi = language.value === "hi") {
    const label = listening
        ? (isHindi ? "सुन रहे हैं..." : "Listening...")
        : (isHindi ? "बोलें" : "Speak");
    voiceBtn.innerHTML = `<span class="voice-glyph" aria-hidden="true"></span><span id="voiceLabel">${label}</span>`;
    voiceBtn.setAttribute("aria-pressed", String(listening));
    voiceBtn.setAttribute("aria-label", listening ? (isHindi ? "माइक्रोफ़ोन सुन रहा है" : "Microphone is listening") : (isHindi ? "बोलकर काम बताएँ" : "Speak a task"));
}

// Translate the visible interface without changing the task text or speech voices.
function applyPageLanguage() {
    const isHindi = language.value === "hi";
    language.setAttribute("aria-label", isHindi ? "इंटरफ़ेस की भाषा" : "Interface language");
    const labels = isHindi ? {
        howLink: "कैसे काम करता है", heroTagline: "डिजिटल दुनिया, आपकी गति से",
        heroTitle: "डिजिटल दुनिया में", heroTitleAccent: "आपका AI गाइड।",
        heroDescription: "Raasta को बताएँ कि आप क्या करना चाहते हैं। आसान दृश्य और आवाज़ वाले चरणों को अपनी गति से पूरा करें।",
        taskLabel: "आज आप किस काम में मदद चाहते हैं?", startLabel: "मुझे गाइड करें",
        suggestionPrompt: "उदाहरण चुनें — वह टेक्स्ट बॉक्स में आएगा; फिर “मुझे गाइड करें” दबाएँ:",
        cardWebsite: "अगला हिस्सा खोलें", cardLanguage: "English + हिन्दी", cardGuidance: "दृश्य मार्गदर्शन",
        howTitle: "“मदद चाहिए” से “मैं कर सकता हूँ।”", howDescription: "तकनीकी विशेषज्ञ होना ज़रूरी नहीं। हम मदद करेंगे।",
        howTellTitle: "हमें बताएँ", howTellDescription: "बताएँ कि आप क्या करना चाहते हैं।",
        howUnderstandTitle: "हम समझेंगे", howUnderstandDescription: "हम आपके काम को आसान निर्देशों में बाँटेंगे।",
        howGuidedTitle: "आपको रास्ता मिलेगा", howGuidedDescription: "हर चरण अपनी गति से पूरा करें।",
        accessibilitySummary: "सुगम्यता सेटिंग्स", textSizeLegend: "अक्षर का आकार", textSizeNormal: "सामान्य", textSizeLarge: "बड़ा", textSizeExtraLarge: "बहुत बड़ा", contrastLabel: "ज़्यादा कंट्रास्ट", speechSpeedLabel: "आवाज़ की गति", guidanceModeLabel: "मार्गदर्शन शैली", entryExamples: "उदाहरण: “मेरी फीस रसीद ढूँढें” · “मुझे ट्रेन बुक करनी है” · “Wi-Fi जोड़ना सिखाएँ”",
        demoModeTitle: "डेमो मोड", demoModeDescription: "Gemini से संपर्क किए बिना स्थानीय गाइड इस्तेमाल करें।", demoResetBtn: "डेमो रीसेट करें"
    } : {
        howLink: "How it works", heroTagline: "DIGITAL ACCESS, AT YOUR PACE",
        heroTitle: "Your AI guide to", heroTitleAccent: "navigating the digital world.",
        heroDescription: "Tell Raasta what you want to do. Follow clear visual and spoken steps, at a pace that works for you.",
        taskLabel: "What would you like help with today?", startLabel: "Guide me",
        suggestionPrompt: "Choose an example to fill the box, then select Guide me:",
        cardWebsite: "Open the next section", cardLanguage: "English + हिन्दी", cardGuidance: "Visual guidance",
        howTitle: "From “I need help” to “I’ve got this.”", howDescription: "You don't need to be a tech expert. We've got you covered.",
        howTellTitle: "Tell us", howTellDescription: "Describe what you want to accomplish.",
        howUnderstandTitle: "We understand", howUnderstandDescription: "We break your task into simple instructions.",
        howGuidedTitle: "You're guided", howGuidedDescription: "Follow each step at your own pace.",
        accessibilitySummary: "Accessibility settings", textSizeLegend: "Text size", textSizeNormal: "Normal", textSizeLarge: "Large", textSizeExtraLarge: "Extra large", contrastLabel: "High contrast", speechSpeedLabel: "Read-aloud speed", guidanceModeLabel: "Guidance style", entryExamples: "Examples: “Find my fee receipt” · “मुझे ट्रेन बुक करनी है” · “Connect to Wi-Fi”",
        demoModeTitle: "Demo Mode", demoModeDescription: "Use local guides without contacting Gemini.", demoResetBtn: "Reset demo"
    };
    Object.entries(labels).forEach(([id, text]) => { document.getElementById(id).textContent = text; });
    setVoiceButtonLabel(Boolean(activeRecognition), isHindi);
    taskInput.placeholder = isHindi
        ? "उदाहरण: मुझे कॉलेज की फीस की रसीद डाउनलोड करनी है..."
        : "Example: I want to download my college fee receipt...";
    taskInput.setAttribute("aria-label", labels.taskLabel);
    document.documentElement.lang = isHindi ? "hi" : "en";
    document.getElementById("speechSpeed").setAttribute("aria-label", labels.speechSpeedLabel);
    document.getElementById("guidanceModeLabel").textContent = labels.guidanceModeLabel;
    document.getElementById("guidanceMode").setAttribute("aria-label", labels.guidanceModeLabel);
    updateThemeToggleLabel();
    const modeOptions = document.getElementById("guidanceMode").options;
    if (modeOptions?.length >= 2) {
        modeOptions[0].textContent = isHindi ? "शुरुआती (विस्तृत)" : "Beginner (detailed)";
        modeOptions[1].textContent = isHindi ? "अनुभवी (संक्षिप्त)" : "Experienced (concise)";
    }
    updateDemoModeStatus(false);
}

function applyAccessibilitySettings() {
    document.body.classList.remove("text-size-large", "text-size-extra-large", "high-contrast");
    if (accessibilityTextSize === "large") document.body.classList.add("text-size-large");
    if (accessibilityTextSize === "extra-large") document.body.classList.add("text-size-extra-large");
    if (highContrastEnabled) document.body.classList.add("high-contrast");
    document.getElementById("contrastToggle").checked = highContrastEnabled;
    document.getElementById("speechSpeed").value = String(speechSpeed);
    document.getElementById("textSizeNormal").setAttribute("aria-pressed", String(accessibilityTextSize === "normal"));
    document.getElementById("textSizeLarge").setAttribute("aria-pressed", String(accessibilityTextSize === "large"));
    document.getElementById("textSizeExtraLarge").setAttribute("aria-pressed", String(accessibilityTextSize === "extra-large"));
}

accessibilityTextSize = ["normal", "large", "extra-large"].includes(readSessionSetting("text-size", "normal")) ? readSessionSetting("text-size", "normal") : "normal";
highContrastEnabled = readSessionSetting("high-contrast", "false") === "true";
speechSpeed = Number(readSessionSetting("speech-speed", "0.85"));
if (![0.75, 0.85, 1, 1.25, 1.5].includes(speechSpeed)) speechSpeed = 1;
guidanceMode = readSessionSetting("guidance-mode", "beginner") === "experienced" ? "experienced" : "beginner";
document.getElementById("textSizeNormal").addEventListener("click", () => { accessibilityTextSize = "normal"; writeSessionSetting("text-size", accessibilityTextSize); applyAccessibilitySettings(); });
document.getElementById("textSizeLarge").addEventListener("click", () => { accessibilityTextSize = "large"; writeSessionSetting("text-size", accessibilityTextSize); applyAccessibilitySettings(); });
document.getElementById("textSizeExtraLarge").addEventListener("click", () => { accessibilityTextSize = "extra-large"; writeSessionSetting("text-size", accessibilityTextSize); applyAccessibilitySettings(); });
document.getElementById("contrastToggle").addEventListener("change", event => { highContrastEnabled = Boolean(event.target.checked); writeSessionSetting("high-contrast", highContrastEnabled); applyAccessibilitySettings(); });
document.getElementById("speechSpeed").addEventListener("change", event => {
    const requestedSpeed = Number(event.target.value);
    if (![0.75, 0.85, 1, 1.25, 1.5].includes(requestedSpeed)) return;
    speechSpeed = requestedSpeed;
    writeSessionSetting("speech-speed", speechSpeed);
    if (speechPlayback.audio) speechPlayback.audio.playbackRate = speechSpeed;
});
document.getElementById("guidanceMode").addEventListener("change", event => {
    guidanceMode = event.target.value === "experienced" ? "experienced" : "beginner";
    writeSessionSetting("guidance-mode", guidanceMode);
    if (activeGuidance) activeGuidance.refresh();
});

applyPageLanguage();
applyAccessibilitySettings();
document.getElementById("guidanceMode").value = guidanceMode;
applyTheme(currentTheme);
themeToggle.addEventListener("click", () => applyTheme(currentTheme === "dark" ? "light" : "dark", true));

demoModeEnabled = readSessionSetting("demo-mode", "false") === "true";
document.getElementById("demoModeToggle").checked = demoModeEnabled;
updateDemoModeStatus(false);
document.getElementById("demoModeToggle").addEventListener("change", event => {
    demoModeEnabled = Boolean(event.target.checked);
    writeSessionSetting("demo-mode", demoModeEnabled);
    updateDemoModeStatus(true);
});
document.getElementById("demoResetBtn").addEventListener("click", resetDemo);

language.addEventListener("change", () => {
    stopSpeech();
    applyPageLanguage();
    const guide = document.getElementById("guidePanel");
    if (guide && guide.style.display === "block" && (activeGuidance?.task || taskInput.value.trim())) {
        const stepNumber = Number(guide.querySelector(".step-count")?.textContent.match(/\d+/)?.[0]);
        resumeGuideAtStep = Number.isFinite(stepNumber) && stepNumber > 0 ? stepNumber - 1 : 0;
        requestTaskGuide(activeGuidance?.task || taskInput.value.trim(), resumeGuideAtStep);
        resumeGuideAtStep = 0;
    }
});


// Suggested task buttons

const suggestions = document.querySelectorAll(".suggestion");

suggestions.forEach(button => {

    button.addEventListener("click", function () {

        taskInput.value = this.dataset.task;

        taskInput.focus();

    });

});

function updateDemoModeStatus(announce = false) {
    const isHindi = language.value === "hi";
    const state = document.getElementById("demoModeState");
    state.dataset.active = String(demoModeEnabled);
    state.textContent = demoModeEnabled
        ? (isHindi ? "चालू — अनुरोध स्थानीय गाइड से पूरे होंगे; Gemini कॉल नहीं होगा।" : "On — requests use local guides; Gemini will not be called.")
        : (isHindi ? "बंद — कॉन्फ़िगर होने पर अनुरोध AI इस्तेमाल करेंगे।" : "Off — task requests use AI when configured.");
    document.getElementById("demoModeToggle").setAttribute("aria-checked", String(demoModeEnabled));
    document.getElementById("demoModeToggle").setAttribute("aria-label", demoModeEnabled
        ? (isHindi ? "डेमो मोड बंद करें" : "Turn Demo Mode off")
        : (isHindi ? "डेमो मोड चालू करें" : "Turn Demo Mode on"));
    if (announce) setTaskStatus(state.textContent, demoModeEnabled ? "demo" : "info");
}


// Voice Input

voiceBtn.addEventListener("click", function () {

    if (activeRecognition) return;

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        setTaskStatus(language.value === "hi"
            ? "इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। Chrome आज़माएँ।"
            : "Voice input is not supported in this browser. Try Chrome.", "error");
        return;
    }

    const recognition = new SpeechRecognition();
    const recognitionLanguage = language.value;
    activeRecognition = recognition;
    voiceBtn.disabled = true;

    recognition.lang =
        recognitionLanguage === "hi" ? "hi-IN" : "en-IN";

    setVoiceButtonLabel(true, recognitionLanguage === "hi");
    setTaskStatus(recognitionLanguage === "hi" ? "सुन रहे हैं। अब अपना काम बोलें।" : "Listening. Say what you need help with.", "listening");

    recognition.onresult = function (event) {
        if (activeRecognition !== recognition) return;

        taskInput.value =
            event.results[0][0].transcript;

        const submitHint = activeGuidance
            ? (recognitionLanguage === "hi" ? "रास्ता से पूछें दबाएँ।" : "Choose Ask Raasta.")
            : (recognitionLanguage === "hi" ? "गाइड करें दबाएँ।" : "Choose Guide me.");
        setTaskStatus((recognitionLanguage === "hi" ? "पहचाना गया: “" : "Recognized: “") + taskInput.value + (recognitionLanguage === "hi" ? `”। जाँचें, फिर ${submitHint}` : `”. Review it, then ${submitHint}`), "recognized");

    };

    recognition.onerror = function (event) {
        if (activeRecognition !== recognition) return;
        const isHindi = recognitionLanguage === "hi";
        activeRecognition = null;
        voiceBtn.disabled = false;
        setVoiceButtonLabel(false, isHindi);
        const message = event?.error === "not-allowed" || event?.error === "service-not-allowed"
            ? (isHindi ? "आवाज़ से लिखने के लिए ब्राउज़र में माइक्रोफ़ोन की अनुमति दें।" : "Allow microphone access in your browser to use voice input.")
            : event?.error === "no-speech"
                ? (isHindi ? "कोई आवाज़ नहीं मिली। कृपया फिर से बोलें।" : "No speech was detected. Please try again.")
                : event?.error === "audio-capture"
                    ? (isHindi ? "माइक्रोफ़ोन नहीं मिला। कनेक्शन जाँचें और फिर कोशिश करें।" : "No microphone was found. Check that it is connected, then try again.")
                    : event?.error === "network"
                        ? (isHindi ? "आवाज़ पहचान सेवा उपलब्ध नहीं है। फिर से कोशिश करें या लिखें।" : "Speech recognition is unavailable right now. Try again or type your task.")
                : (isHindi ? "आवाज़ समझ नहीं आई। कृपया फिर से कोशिश करें।" : "Could not recognize your voice. Please try again.");
        setTaskStatus(message, "error");

    };

    recognition.onend = function () {
        if (activeRecognition !== recognition) return;
        activeRecognition = null;
        voiceBtn.disabled = false;
        setVoiceButtonLabel(false);

    };

    try {
        recognition.start();
    } catch {
        activeRecognition = null;
        voiceBtn.disabled = false;
        setVoiceButtonLabel(false);
        setTaskStatus(recognitionLanguage === "hi"
            ? "आवाज़ से लिखना शुरू नहीं हो सका। कृपया फिर से कोशिश करें।"
            : "Voice input could not start. Please try again.", "error");
    }

});

function stopVoiceRecognition() {
    const recognition = activeRecognition;
    activeRecognition = null;
    try {
        if (typeof recognition?.abort === "function") recognition.abort();
        else recognition?.stop?.();
    } catch { /* Reset continues even if the browser already ended recognition. */ }
    voiceBtn.disabled = false;
    setVoiceButtonLabel(false);
}


// Speech playback: Sarvam handles Hindi; browser speech keeps English local.
function restoreSpeechButton(button) {
    if (!button) return;
    if (button._speechOriginalMarkup !== undefined) {
        button.innerHTML = button._speechOriginalMarkup;
        delete button._speechOriginalMarkup;
    }
    button.disabled = false;
    button.setAttribute("aria-busy", "false");
}

function clearAudioPlayback() {
    if (speechPlayback.audio) {
        speechPlayback.audio.pause();
        speechPlayback.audio.removeAttribute?.("src");
        speechPlayback.audio.load?.();
    }
    if (speechPlayback.objectUrl) URL.revokeObjectURL(speechPlayback.objectUrl);
    speechPlayback.audio = null;
    speechPlayback.objectUrl = null;
}

function stopSpeech() {
    speechPlayback.requestId += 1;
    speechPlayback.controller?.abort();
    speechPlayback.controller = null;
    clearAudioPlayback();
    window.speechSynthesis?.cancel();
    restoreSpeechButton(speechPlayback.button);
    speechPlayback.button = null;
}

// Browsers load speech voices asynchronously, so getVoices() can be empty on first use.
function loadVoices(synth, timeoutMs = 2000) {
    return new Promise(resolve => {
        const existing = synth.getVoices();
        if (existing.length) {
            resolve(existing);
            return;
        }
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            synth.removeEventListener?.("voiceschanged", finish);
            resolve(synth.getVoices());
        };
        synth.addEventListener?.("voiceschanged", finish);
        setTimeout(finish, timeoutMs);
    });
}

// Voice language tags differ by browser and OS (hi-IN, hi_IN, hi), so normalise before matching.
function normaliseLang(tag) {
    return String(tag || "").toLowerCase().replace("_", "-");
}

function findHindiVoice(voices) {
    const hindi = voices.filter(v => {
        const tag = normaliseLang(v.lang);
        return tag === "hi" || tag.startsWith("hi-");
    });
    return hindi.find(v => normaliseLang(v.lang) === "hi-in") || hindi[0] || null;
}

function speakWithBrowser(text) {
    const synth = window.speechSynthesis;

    if (!synth) {
        setTaskStatus(language.value === "hi"
            ? "इस ब्राउज़र में आवाज़ चलाना उपलब्ध नहीं है।"
            : "Speech output is not supported in this browser.", "error");
        return;
    }

    synth.cancel();

    // Speak immediately when voices are already loaded; otherwise wait for the browser to load them.
    const voices = synth.getVoices();
    if (voices.length) {
        speakWithVoices(synth, text, voices);
        return;
    }
    loadVoices(synth).then(loaded => speakWithVoices(synth, text, loaded));
}

function speakWithVoices(synth, text, voices) {
    const speech = new SpeechSynthesisUtterance(text);

    speech.rate = speechSpeed;
    speech.pitch = 1;
    speech.volume = 1;

    if (language.value === "hi") {

        const hindiVoice = findHindiVoice(voices);

        if (!hindiVoice) {
            setTaskStatus(
                "हिंदी आवाज़ नहीं मिली। Microsoft Edge या Google Chrome में खोलें, या Windows Settings > Time & language > Language & region में Hindi जोड़ें और Speech डाउनलोड करें। "
                + "No Hindi voice found. Open Raasta in Microsoft Edge or Google Chrome, or add Hindi speech in Windows Settings > Time & language > Language & region.",
                "error"
            );
            return;
        }

        speech.voice = hindiVoice;
        speech.lang = hindiVoice.lang;

    } else {

        const englishVoice = voices.find(v =>
            v.lang.toLowerCase() === "en-in"
        ) || voices.find(v =>
            v.lang.toLowerCase().startsWith("en")
        );

        if (englishVoice) {
            speech.voice = englishVoice;
            speech.lang = englishVoice.lang;
        }

    }

    synth.speak(speech);
}

function fallbackToBrowserSpeech(text, requestId) {
    if (requestId !== speechPlayback.requestId) return;
    speechPlayback.requestId += 1;
    speechPlayback.controller = null;
    clearAudioPlayback();
    restoreSpeechButton(speechPlayback.button);
    speechPlayback.button = null;
    setTaskStatus(language.value === "hi"
        ? "Sarvam अभी उपलब्ध नहीं है; ब्राउज़र की हिंदी आवाज़ से चला रहे हैं।"
        : "Sarvam is unavailable; using your browser's Hindi voice.", "info");
    speakWithBrowser(text);
}

async function speakText(text, button = null) {
    stopSpeech();
    if (language.value !== "hi") {
        speakWithBrowser(text);
        return;
    }

    const requestId = speechPlayback.requestId;
    const controller = new AbortController();
    speechPlayback.controller = controller;
    speechPlayback.button = button;
    if (button) {
        button._speechOriginalMarkup = button.innerHTML;
        button.innerHTML = "⏳ ऑडियो बन रहा है…";
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    }

    try {
        const response = await fetch("/api/speech/hindi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, languageCode: "hi-IN" }),
            signal: controller.signal
        });
        if (!response.ok) throw new Error("Hindi speech request failed");
        const audioBlob = await response.blob();
        if (requestId !== speechPlayback.requestId) return;
        speechPlayback.objectUrl = URL.createObjectURL(audioBlob);
        const audio = new window.Audio(speechPlayback.objectUrl);
        audio.playbackRate = speechSpeed;
        speechPlayback.audio = audio;
        audio.onended = () => {
            if (requestId !== speechPlayback.requestId) return;
            clearAudioPlayback();
            speechPlayback.controller = null;
            restoreSpeechButton(speechPlayback.button);
            speechPlayback.button = null;
        };
        audio.onerror = () => fallbackToBrowserSpeech(text, requestId);
        await audio.play();
    } catch (error) {
        if (error?.name !== "AbortError") fallbackToBrowserSpeech(text, requestId);
    }
}

const supportedPortalTargets = ["portalDocuments", "portalReceipts", "portalDownload"];
const supportedWorkflowTargets = {
    fee_receipt: supportedPortalTargets,
    train_booking: ["trainSource", "trainDestination", "trainDate", "trainSearch", "trainSelect", "trainPassenger", "trainReview", "bookingConfirm"],
    document_download: ["documentOpen", "documentCategory", "documentSample", "documentPreview", "documentDownload"],
    upi_payment: ["upiOpenApp", "upiChooseMethod", "upiEnterId", "upiEnterAmount", "upiSelectAccount", "upiEnterPin", "upiSuccess"],
    email_attachment: ["emailCompose", "emailTo", "emailSubject", "emailBody", "emailAttach", "emailSend", "emailSent"],
    chat_message: ["chatOpenChat", "chatAttach", "chatGallery", "chatPickPhoto", "chatCaption", "chatSend", "chatSent"],
    smartphone_basics: {
        wifi: ["phoneSettings", "phoneWifi", "phoneNetwork", "phoneConnect", "phoneConnected"],
        brightness: ["phoneSettings", "phoneDisplay", "phoneBrightness", "phoneBrightnessDone"],
        bluetooth: ["phoneSettings", "phoneBluetooth", "phoneToggle", "phoneBluetoothDone"],
        chooser: ["phoneTutorialChoice"]
    }
};

function setTaskStatus(message, kind = "info") {
    const status = document.getElementById("taskStatus");
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = !message;
}

function guidanceDetail(target, title, isHindi, mode = guidanceMode) {
    if (mode === "experienced") return "";
    const detail = isHindi ? {
        trainSource: "शुरुआती शहर का मतलब है जहाँ से यात्रा शुरू होगी।",
        trainDestination: "गंतव्य वह शहर है जहाँ आप पहुँचना चाहते हैं।",
        documentCategory: "श्रेणी का मतलब है दस्तावेज़ का प्रकार।",
        portalReceipts: "यहाँ नमूना फीस रसीदें दिखाई जाती हैं।",
        phoneConnect: "यह केवल अभ्यास वाला नेटवर्क है।",
        phoneToggle: "यह बदलाव केवल सिम्युलेटेड फोन स्क्रीन पर होगा।",
        upiEnterId: "दिखने वाला नाम बैंक में दर्ज होता है; जाँचें कि यह वही व्यक्ति या दुकान है जिसे आप भुगतान करना चाहते हैं।",
        upiSelectAccount: "वह बैंक खाता चुनें जिससे पैसे कटने चाहिए।",
        upiEnterPin: "आपका UPI PIN गोपनीय है। असली पेमेंट ऐप आपसे इसे साझा करने को नहीं कहते।",
        emailTo: "To वाले खाने में पाने वाले का ईमेल पता लिखा जाता है।",
        emailAttach: "अटैचमेंट वह फ़ाइल है जो आपके ईमेल के साथ जाती है।",
        chatAttach: "क्लिप के निशान से आप चैट में फोटो या फ़ाइल जोड़ सकते हैं।",
        chatSent: "दो टिक आमतौर पर बताते हैं कि संदेश दूसरे फोन तक पहुँच गया।"
    } : {
        trainSource: "The starting city is where the journey begins.",
        trainDestination: "The destination is the city you are travelling to.",
        documentCategory: "A category means the kind of document you need.",
        portalReceipts: "This area contains sample college fee receipts.",
        phoneConnect: "This is only a sample network in the practice screen.",
        phoneToggle: "This changes only the simulated phone screen.",
        upiEnterId: "The name shown is registered with the bank; check it is the person or shop you mean to pay.",
        upiSelectAccount: "Choose the bank account the money should come from.",
        upiEnterPin: "Your UPI PIN is secret. Real payment apps never ask you to share it.",
        emailTo: "The To box is where the receiver's email address goes.",
        emailAttach: "An attachment is a file that travels with your email.",
        chatAttach: "The paperclip lets you add a photo or file to the chat.",
        chatSent: "Two ticks usually mean the message reached the other phone."
    };
    const prefix = isHindi
        ? `सिम्युलेटर में पीले रंग से हाइलाइट किए गए “${title}” कंट्रोल को देखें।`
        : `In the simulation panel, look for the yellow highlighted “${title}” control.`;
    const oneAction = isHindi ? "अभी केवल यही एक चरण करें।" : "Do only this one step for now.";
    return [prefix, detail[target], oneAction].filter(Boolean).join(" ");
}

function formatGuidanceInstruction(instruction, target, title, isHindi, forceBeginner = false) {
    if (!target) {
        const oneAction = isHindi ? "एक समय में यही एक काम करें।" : "Focus on this one action at a time.";
        return [forceBeginner || guidanceMode !== "experienced" ? oneAction : "", instruction].filter(Boolean).join(" ");
    }
    return [guidanceDetail(target, title, isHindi, forceBeginner ? "beginner" : guidanceMode), instruction].filter(Boolean).join(" ");
}

function classifyGuideFollowUp(value) {
    const text = String(value || "").normalize("NFKC").toLocaleLowerCase().trim();
    if (/\b(?:start\s+(?:again|over|new task)|restart|begin\s+again)\b|(?:फिर|दोबारा)\s*से\s*शुरू|नया\s*काम/u.test(text)) return "restart";
    if (/\b(?:go\s+back|previous(?:\s+step)?|back\s+one\s+step|last\s+step)\b|\b(?:pich(?:he|che|hle)|pichhla|pichla|peeche|wapas)\b|(?:पीछे|पिछला|पिछले\s*चरण)/u.test(text)) return "previous";
    if (/\b(?:next(?:\s+step)?|go\s+next|continue|move\s+on)\b|\b(?:agla(?:\s+step)?|aage)\b|(?:अगला|अगले\s*चरण|आगे)/u.test(text)) return "next";
    if (/\b(?:repeat|say\s+it\s+again|say\s+again|explain\s+again|read\s+again)\b|\b(?:dobara\s+batao|phir\s+se\s+batao|dohr(?:ao|ana))\b|(?:दोबारा|फिर\s*से\s*बताएँ|दोहराएँ)/u.test(text)) return "repeat";
    if (/\b(?:where\s+(?:do\s+i|should\s+i)\s+click|where\s+to\s+click|which\s+button|can't\s+find|cannot\s+find|not\s+find(?:ing)?|i'm\s+stuck|im\s+stuck|option\s+(?:is\s+)?missing|(?:ye|yeh)\s+option\s+nahi\s+mil|nahi\s+mil\s+raha|kahan\s+click|kahaan\s+click|atka\s+hua)\b|(?:कहाँ\s*क्लिक|किस\s*बटन|नहीं\s*मिल|नहीं\s*दिख|अटक\s*गया)/u.test(text)) return "stuck";
    if (/\b(?:i\s+don't\s+understand|i\s+do\s+not\s+understand|i\s+don't\s+get\s+it|what\s+now|what\s+should\s+i\s+do|can\s+you\s+simplify|make\s+it\s+simple|explain\s+(?:this|that)|can\s+you\s+explain)\b|\b(?:mujhe\s+samajh|samajh\s+nahi\s+(?:aaya|aya|aaya)|ab\s+kya\s+karna|thoda\s+simple|thoda\s+asaan|simple\s+batao)\b|(?:समझ\s*नहीं|अब\s*क्या\s*करना|थोड़ा\s*सरल|आसान\s*बताएँ)/u.test(text)) return "simplify";
    if (/\b(?:help|please\s+explain|i\s+need\s+help|madad|samjhao)\b|(?:मदद|समझाएँ|बताइए\s*ना)/u.test(text)) return "clarify";
    return "unrelated";
}

function classifyGuideInput(value) {
    const followUp = classifyGuideFollowUp(value);
    const text = String(value || "").normalize("NFKC").toLocaleLowerCase().trim();
    const taskSubject = /\b(?:tv|television|hdmi|ps5|playstation|console|controller|headphones?|earbuds?|laptop|computer|windows|mac(?:book)?|phone|smartphone|mobile|bluetooth|wi[ -]?fi|wifi|hotspot|screenshot|application|software|gmail|google\s+account|location|router|password|fee|fees|receipt|train|document|certificate|marksheet|portal|account|printer|screen|settings?|browser|chrome|firefox|edge|safari)\b|टीवी|टेलीविज़न|प्लेस्टेशन|कंसोल|कंट्रोलर|हेडफोन|लैपटॉप|कंप्यूटर|फोन|मोबाइल|ब्लूटूथ|वाई[ -]?फाई|हॉटस्पॉट|स्क्रीनशॉट|जीमेल|लोकेशन|राउटर|पासवर्ड|फीस|रसीद|ट्रेन|दस्तावेज़?|प्रमाणपत्र|मार्कशीट|पोर्टल|ब्राउज़र|क्रोम|सेटिंग/u;
    const taskAction = /\b(?:turn|switch|power|start|connect|pair|enable|disable|change|select|choose|take|capture|install|create|download|book|find|open|use|navigate|configure|manage|adjust|increase|decrease|fix|troubleshoot|setup|set\s+up|reset|restart|factory\s+reset|delete|erase|wipe|format|purchase|pay(?:ment)?|chalu|band|kar(?:na|ni|ne|u|o|do)|jod(?:na|o)|bana(?:na|o)|badal(?:na|o)|kaise|sikha(?:o|na))\b|चालू|शुरू|बंद|जोड़|कनेक्ट|बदल|चुन|करना|करनी|करूँ|करो|कैसे|डाउनलोड|बनाओ|रीसेट|हटाओ|मिटाओ|बुक|इंस्टॉल/u;
    const clearDeviceAction = taskSubject.test(text) && taskAction.test(text);
    if (followUp !== "unrelated") {
        if (followUp === "restart" && clearDeviceAction) return { kind: "new_task", action: null };
        return {
            kind: ["previous", "next", "restart"].includes(followUp) ? "navigation" : "contextual_help",
            action: followUp
        };
    }

    if (clearDeviceAction) return { kind: "new_task", action: null };
    if (taskSubject.test(text)) return { kind: "ambiguous", action: null };
    return { kind: "unrelated", action: "unrelated" };
}

function registerActiveGuidance(context) {
    activeGuidance = context;
    const isHindi = language.value === "hi";
    document.getElementById("taskLabel").textContent = isHindi ? "इस चरण में मदद चाहिए?" : "Need help with this step?";
    taskInput.setAttribute("aria-label", isHindi ? "इस चरण में मदद चाहिए?" : "Need help with this step?");
    taskInput.placeholder = isHindi
        ? "उदाहरण: मुझे समझ नहीं आया, अगला चरण, या दोबारा बताएँ..."
        : "Try: I'm stuck, where do I click, next, or repeat...";
    document.getElementById("startLabel").textContent = isHindi ? "रास्ता से पूछें" : "Ask Raasta";
}

function clearActiveGuidance() {
    activeGuidance = null;
    const isHindi = language.value === "hi";
    document.getElementById("taskLabel").textContent = isHindi ? "आज आप किस काम में मदद चाहते हैं?" : "What would you like help with today?";
    taskInput.setAttribute("aria-label", isHindi ? "आज आप किस काम में मदद चाहते हैं?" : "What would you like help with today?");
    taskInput.placeholder = isHindi ? "उदाहरण: मुझे कॉलेज की फीस की रसीद डाउनलोड करनी है..." : "Example: I want to download my college fee receipt...";
    document.getElementById("startLabel").textContent = isHindi ? "मुझे गाइड करें" : "Guide me";
}

function resetDemo() {
    taskRequestId += 1;
    resumeGuideAtStep = 0;
    activeTaskController?.abort();
    activeTaskController = null;
    stopSpeech();
    stopVoiceRecognition();
    document.querySelectorAll(".active-target").forEach(element => element.classList.remove("active-target"));
    document.getElementById("guidePanel")?.remove?.();
    clearActiveGuidance();
    taskInput.value = "";
    startBtn.disabled = false;
    language.disabled = false;
    document.getElementById("startLabel").textContent = language.value === "hi" ? "मुझे गाइड करें" : "Guide me";
    setTaskStatus(language.value === "hi"
        ? "डेमो रीसेट हुआ। अस्थायी गाइड साफ़ है; आपकी सुगम्यता और मार्गदर्शन सेटिंग्स सुरक्षित हैं।"
        : "Demo reset. Temporary guide state cleared; your accessibility and guidance preferences are preserved.", "info");
    taskInput.focus();
    taskInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

function handleGuideFollowUp(value) {
    if (!activeGuidance) return false;
    const newTaskPrefix = String(value || "").normalize("NFKC").match(/^(?:new\s+task|start\s+new\s+task|नया\s*काम)\s*[:：-]?\s*(.*)$/iu);
    if (newTaskPrefix) {
        const newTask = newTaskPrefix[1].trim();
        if (!newTask) {
            const question = language.value === "hi" ? "कौन-सा नया काम शुरू करना चाहते हैं? यहाँ लिखें और फिर “रास्ता से पूछें” दबाएँ।" : "What new task would you like to start? Enter it here, then choose Ask Raasta.";
            activeGuidance.setFeedback(question);
            setTaskStatus(question, "context");
            speakText(question);
            return true;
        }
        if (newTask.length < 4 || newTask.length > 500) {
            const validation = language.value === "hi" ? "नया काम 4 से 500 अक्षरों का होना चाहिए। आपकी मौजूदा गाइड सुरक्षित है।" : "The new task must be 4 to 500 characters. Your current guide is unchanged.";
            activeGuidance.setFeedback(validation);
            setTaskStatus(validation, "error");
            speakText(validation);
            return true;
        }
        taskInput.value = newTask;
        setTaskStatus("", "info");
        requestTaskGuide(newTask, 0, true);
        return true;
    }
    const classifiedInput = classifyGuideInput(value);
    const intent = classifiedInput.action;
    const current = activeGuidance.getCurrent();
    const isHindi = language.value === "hi";
    const showMessage = (message, speak = true) => {
        activeGuidance.setFeedback(message);
        setTaskStatus(message, "context");
        if (speak) speakText(message);
    };

    if (intent === "restart") {
        if (/\bnew task\b|नया\s*काम/u.test(String(value || "").toLocaleLowerCase()) && !activeGuidance.completed) {
            showMessage(isHindi ? "पहले यह गाइड पूरी करें या नया काम शुरू करने के लिए “रीस्टार्ट” कहें।" : "Finish this guide first, or say “restart” to begin again.");
            return true;
        }
        activeGuidance.restart();
        showMessage(isHindi ? "गाइड पहले चरण से फिर शुरू हुई है।" : "The guide has restarted at the first step.", false);
        return true;
    }
    if (intent === "previous") {
        if (activeGuidance.completed) {
            showMessage(isHindi ? "गाइड पूरी हो चुकी है। फिर से शुरू करने के लिए “रीस्टार्ट” कहें।" : "This guide is complete. Say “restart” to begin again.");
            return true;
        }
        if (current.index === 0) showMessage(isHindi ? "यह पहला चरण है; इससे पहले कोई चरण नहीं है।" : "This is the first step; there is no earlier step.");
        else {
            activeGuidance.previous();
            showMessage(activeGuidance.getCurrent().instruction);
        }
        return true;
    }
    if (intent === "next") {
        if (activeGuidance.completed) showMessage(isHindi ? "गाइड पूरी हो चुकी है। फिर से शुरू करने के लिए “रीस्टार्ट” कहें।" : "This guide is complete. Say “restart” to begin again.");
        else {
            activeGuidance.next();
            if (activeGuidance.completed) showMessage(isHindi ? "सिम्युलेटेड गाइड पूरी हुई। कोई वास्तविक काम नहीं किया गया।" : "The simulated guide is complete. No real action was taken.");
            else showMessage(activeGuidance.getCurrent().instruction);
        }
        return true;
    }
    if (intent === "repeat") {
        if (activeGuidance.completed) showMessage(isHindi ? "सिम्युलेटेड गाइड पूरी हुई। कोई वास्तविक काम नहीं किया गया। फिर से शुरू करने के लिए “रीस्टार्ट” कहें।" : "The simulated guide is complete. No real action was taken. Say “restart” to begin again.");
        else showMessage(current.instruction);
        return true;
    }
    if (intent === "stuck" || intent === "simplify") {
        const title = current.title;
        const simpleInstruction = formatGuidanceInstruction(current.rawInstruction, current.target, title, isHindi, true);
        const message = intent === "stuck"
            ? (current.target
                ? (isHindi
                    ? `अभी “${title}” वाला पीला हाइलाइट किया गया कंट्रोल सिम्युलेटर में ढूँढें। वह न दिखे तो थोड़ा स्क्रॉल करें; चरण आगे बढ़ाने के लिए अगला दबाएँ।`
                    : `Look for the yellow highlighted “${title}” control in the simulation. If it is out of view, scroll a little. Use Next only when you are ready to move on.`)
                : (isHindi
                    ? `यह आपके वास्तविक उपकरण के लिए सामान्य निर्देश है; Raasta उसकी स्क्रीन नहीं देख रहा। अभी यह करें: ${current.rawInstruction} विकल्प का नाम अलग हो तो अपने उपकरण की Settings में खोजें।`
                    : `These are general instructions for your device; Raasta cannot see its screen. For this step: ${current.rawInstruction} If the label differs, search in your device settings.`))
            : simpleInstruction;
        showMessage(message);
        return true;
    }
    if (classifiedInput.kind === "new_task") {
        requestTaskGuide(String(value || "").trim(), 0, true);
        return true;
    }
    if (intent === "clarify") {
        showMessage(isHindi ? "क्या मैं इस चरण को सरल शब्दों में समझाऊँ या बताऊँ कि कहाँ क्लिक करना है?" : "Would you like a simpler explanation, or help finding where to click?");
        return true;
    }
    if (classifiedInput.kind === "ambiguous") {
        showMessage(isHindi
            ? "आप इस उपकरण पर क्या करना चाहते हैं? काम बताइए, जैसे टीवी चालू करना या HDMI input बदलना।"
            : "What would you like to do with this device? For example, turn on the TV or change its HDMI input.", false);
        return true;
    }
    showMessage(isHindi
        ? `यह सवाल इस गाइड से अलग है। क्या आप मौजूदा चरण जारी रखना चाहेंगे या “नया काम: …” लिखकर बदलना चाहेंगे?`
        : `That question is outside this guide. Would you like to continue the current step or switch tasks with “new task: …”?`, false);
    return true;
}

function titleForWorkflow(category, isHindi) {
    const titles = isHindi
        ? { fee_receipt: "फीस रसीद", train_booking: "ट्रेन बुकिंग", document_download: "दस्तावेज़ डाउनलोड", smartphone_basics: "फोन ट्यूटोरियल", upi_payment: "UPI भुगतान", email_attachment: "अटैचमेंट के साथ ईमेल", chat_message: "चैट संदेश" }
        : { fee_receipt: "fee receipt", train_booking: "train booking", document_download: "document download", smartphone_basics: "phone tutorial", upi_payment: "UPI payment", email_attachment: "email with attachment", chat_message: "chat message" };
    return titles[category] || (isHindi ? "आपकी गाइड" : "your guide");
}

async function requestTaskGuide(task, startingStep = 0, preserveCurrentOnUnsupported = false) {
    stopSpeech();
    const isHindi = language.value === "hi";
    const requestDemoMode = demoModeEnabled;
    if (task.length < 4 || task.length > 500) {
        setTaskStatus(isHindi
            ? "कृपया 4 से 500 अक्षरों के बीच अपना काम लिखें।"
            : "Please enter a task between 4 and 500 characters.", "error");
        taskInput.focus();
        return;
    }

    activeTaskController?.abort();
    const requestId = ++taskRequestId;
    const controller = new AbortController();
    activeTaskController = controller;

    startBtn.disabled = true;
    language.disabled = true;
    document.getElementById("startLabel").textContent = isHindi ? "समझ रहे हैं..." : "Understanding...";
    setTaskStatus(isHindi ? "आपके काम को समझा जा रहा है..." : "Understanding your task...", "loading");

    try {
        const response = await fetch("/api/understand-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, language: language.value, demoMode: requestDemoMode }),
            signal: controller.signal
        });
        const result = await response.json();
        if (requestId !== taskRequestId) return;
        if (!response.ok) throw new Error(result.error || "Task understanding failed.");
        if (!result || typeof result !== "object" || !Array.isArray(result.steps)) {
            throw new Error("The guide service returned an invalid result.");
        }

        if (result.supported) {
            if (result.category === "universal_guidance") {
                const validUniversalSteps = result.steps.length >= 2 && result.steps.length <= 8 && result.steps.every(step =>
                    step && typeof step.title === "string" && step.title.trim() &&
                    typeof step.instruction === "string" && step.instruction.trim() && !Object.hasOwn(step, "targetElementId")
                );
                if (!validUniversalSteps) throw new Error("The general guide did not contain safe, target-free steps.");
            } else {
                const expectedTargets = result.category === "smartphone_basics"
                    ? supportedWorkflowTargets.smartphone_basics[result.topic || "chooser"]
                    : supportedWorkflowTargets[result.category];
                const validTargets = Array.isArray(expectedTargets) &&
                    result.steps.length === expectedTargets.length &&
                    result.steps.every((step, index) =>
                        step && step.targetElementId === expectedTargets[index] &&
                        typeof step.instruction === "string" && step.instruction.trim()
                    );
                if (!validTargets) throw new Error("The guide included an unsupported portal target.");
            }
        } else if (result.steps.some(step => step?.targetElementId)) {
            throw new Error("Unsupported tasks cannot target portal controls.");
        }

        if (requestDemoMode || result.mode === "demo") {
            setTaskStatus(isHindi
                ? "डेमो मोड सक्रिय है — स्थानीय उदाहरण गाइड चल रही है; Gemini कॉल नहीं हुआ।"
                : "Demo Mode is active — using a local example guide; Gemini was not called.", "demo");
        } else if (result.mode === "fallback") {
            setTaskStatus(result.message || (isHindi
                ? "Gemini अभी उपलब्ध नहीं है; सुरक्षित स्थानीय मार्गदर्शन दिखाया जा रहा है।"
                : "Gemini is temporarily unavailable; showing the safe local guide."), "demo");
        } else {
            setTaskStatus("");
        }

        if (result.supported) showGuide(task, result, startingStep);
        else if (preserveCurrentOnUnsupported && activeGuidance) {
            const clarification = result.clarifyingQuestion || (isHindi
                ? "मौजूदा चरण सुरक्षित है। कृपया बताइए कि आप क्या करना चाहते हैं।"
                : "Your current step is unchanged. Please tell me what you would like to do.");
            activeGuidance.setFeedback(clarification);
            setTaskStatus(clarification, "context");
        } else showClarification(task, result);
    } catch (error) {
        if (requestId !== taskRequestId || error.name === "AbortError") return;
        setTaskStatus(isHindi
            ? `${error.message || "अनुरोध पूरा नहीं हो सका।"} सर्वर चल रहा है या नहीं जाँचें।`
            : `${error.message || "The request could not be completed."} Check that Raasta is running with npm start.`, "error");
    } finally {
        if (requestId === taskRequestId) {
            activeTaskController = null;
            startBtn.disabled = false;
            language.disabled = false;
            document.getElementById("startLabel").textContent = language.value === "hi" ? "मुझे गाइड करें" : "Guide me";
        }
    }
}

function showClarification(task, result) {
    clearActiveGuidance();
    let guide = document.getElementById("guidePanel");
    if (!guide) {
        guide = document.createElement("section");
        guide.id = "guidePanel";
        guide.className = "guide-panel";
        document.querySelector(".hero").after(guide);
    }
    guide.style.display = "block";
    const isHindi = language.value === "hi";
    guide.innerHTML = `
        <div class="guide-content">
            <p class="tagline">${isHindi ? "रास्ता गाइड" : "RAASTA GUIDE"}</p>
            <h2 id="clarificationTitle"></h2>
            <p class="guide-task"></p>
            <p id="clarificationQuestion" class="clarification-question" aria-live="polite"></p>
            <div class="guide-buttons">
                <button id="clarificationSpeak" class="voice-btn" type="button">🔊 ${isHindi ? "सुनें" : "Read aloud"}</button>
                <button id="editTaskBtn" class="start-btn" type="button">${isHindi ? "काम बदलें" : "Change task"}</button>
            </div>
        </div>`;
    guide.querySelector("#clarificationTitle").textContent = isHindi ? "मुझे थोड़ा और बताइए" : "Tell me a little more";
    guide.querySelector(".guide-task").textContent = (isHindi ? "आपका काम: " : "Your task: ") + (result.task || task);
    guide.querySelector("#clarificationQuestion").textContent = result.clarifyingQuestion || (isHindi
        ? "अभी डेमो केवल कॉलेज की फीस रसीद डाउनलोड करने में मदद करता है। क्या आप उसी में मदद चाहते हैं?"
        : "The demo currently supports college fee receipt downloads. Is that what you want help with?");
    guide.querySelector("#clarificationSpeak").onclick = () => speakText(guide.querySelector("#clarificationQuestion").textContent, guide.querySelector("#clarificationSpeak"));
    guide.querySelector("#editTaskBtn").onclick = () => {
        taskInput.focus();
        taskInput.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    guide.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Demo Task Instructions

function getInstructions(task) {

    const text = task.toLowerCase();

    if (
        text.includes("train") || text.includes("ट्रेन") ||
        text.includes("ticket") || text.includes("टिकट") ||
        text.includes("railway")
    ) {

        return [
            "Open the railway ticket booking website.",
            "Enter your departure and destination stations.",
            "Select your journey date and search for trains.",
            "Choose a train and review the booking details."
        ];

    }

    else if (
        text.includes("document") || text.includes("दस्तावेज़") ||
        text.includes("download") ||
        text.includes("receipt") || text.includes("रसीद") ||
        text.includes("fee") || text.includes("फीस")
    ) {

        return [
            "Open the website where your document is available.",
            "Log in to your account if required.",
            "Find the Documents or Downloads section.",
            "Select your document and click Download."
        ];

    }

    else if (
        text.includes("phone") || text.includes("फोन") ||
        text.includes("mobile") || text.includes("मोबाइल") ||
        text.includes("smartphone")
    ) {

        return [
            "Open the Settings application on your phone.",
            "Look for the feature you want to change.",
            "Select the relevant setting.",
            "Follow the instructions displayed on your screen."
        ];

    }

    else {

        return [
            "Identify the website or application you need to use.",
            "Look for the main menu or search option.",
            "Find the section related to your task.",
            "Follow the instructions and check your result."
        ];

    }

}


// Hindi Instructions

function translateToHindi(instructions) {

    const translations = {

        "Open the railway ticket booking website.":
            "रेलवे टिकट बुकिंग वेबसाइट खोलें।",

        "Enter your departure and destination stations.":
            "अपना शुरुआती और गंतव्य स्टेशन दर्ज करें।",

        "Select your journey date and search for trains.":
            "यात्रा की तारीख चुनें और ट्रेन खोजें।",

        "Choose a train and review the booking details.":
            "एक ट्रेन चुनें और बुकिंग की जानकारी जाँचें।",

        "Open the website where your document is available.":
            "वह वेबसाइट खोलें जहाँ आपका दस्तावेज़ उपलब्ध है।",

        "Log in to your account if required.":
            "यदि आवश्यक हो तो अपने अकाउंट में लॉग इन करें।",

        "Find the Documents or Downloads section.":
            "Documents या Downloads सेक्शन खोजें।",

        "Select your document and click Download.":
            "अपना दस्तावेज़ चुनें और Download पर क्लिक करें।",

        "Open the Settings application on your phone.":
            "अपने फोन में Settings ऐप खोलें।",

        "Look for the feature you want to change.":
            "उस फीचर को खोजें जिसे आप बदलना चाहते हैं।",

        "Select the relevant setting.":
            "संबंधित सेटिंग चुनें।",

        "Follow the instructions displayed on your screen.":
            "स्क्रीन पर दिए गए निर्देशों का पालन करें।",

        "Identify the website or application you need to use.":
            "उस वेबसाइट या ऐप को पहचानें जिसका आपको उपयोग करना है।",

        "Look for the main menu or search option.":
            "मुख्य मेन्यू या सर्च विकल्प खोजें।",

        "Find the section related to your task.":
            "अपने काम से संबंधित सेक्शन खोजें।",

        "Follow the instructions and check your result.":
            "निर्देशों का पालन करें और परिणाम जाँचें।"

    };

    return instructions.map(step =>
        translations[step] || step
    );

}

function phoneTutorialSteps(topic, isHindi) {
    const definitions = {
        wifi: isHindi
            ? [["सिम्युलेटेड Settings खोलें।", "phoneSettings"], ["Wi-Fi सेटिंग खोलें।", "phoneWifi"], ["Campus Wi-Fi चुनें।", "phoneNetwork"], ["Connect दबाएँ।", "phoneConnect"], ["कनेक्शन की स्थिति देखें।", "phoneConnected"]]
            : [["Open simulated Settings.", "phoneSettings"], ["Open the Wi-Fi setting.", "phoneWifi"], ["Choose the demo network.", "phoneNetwork"], ["Select Connect.", "phoneConnect"], ["Check the simulated connection status.", "phoneConnected"]],
        brightness: isHindi
            ? [["सिम्युलेटेड Settings खोलें।", "phoneSettings"], ["Display सेटिंग खोलें।", "phoneDisplay"], ["Brightness slider बदलें।", "phoneBrightness"], ["नई चमक की स्थिति देखें।", "phoneBrightnessDone"]]
            : [["Open simulated Settings.", "phoneSettings"], ["Open Display settings.", "phoneDisplay"], ["Adjust the brightness slider.", "phoneBrightness"], ["Check the simulated brightness level.", "phoneBrightnessDone"]],
        bluetooth: isHindi
            ? [["सिम्युलेटेड Settings खोलें।", "phoneSettings"], ["Bluetooth सेटिंग खोलें।", "phoneBluetooth"], ["Bluetooth स्विच बदलें।", "phoneToggle"], ["स्थिति की पुष्टि करें।", "phoneBluetoothDone"]]
            : [["Open simulated Settings.", "phoneSettings"], ["Open the Bluetooth setting.", "phoneBluetooth"], ["Toggle the Bluetooth switch.", "phoneToggle"], ["Check the simulated status.", "phoneBluetoothDone"]]
    };
    return (definitions[topic] || []).map(([instruction, targetElementId]) => ({ instruction, targetElementId }));
}

function showWorkflowGuide(task, originalPlan, startingStep = 0) {
    const isHindi = language.value === "hi";
    let plan = { ...originalPlan, steps: [...originalPlan.steps] };
    let currentStep = Math.max(0, Math.min(startingStep, plan.steps.length - 1));
    let state = {};
    const resetState = () => {
        state = {
            source: plan.source || "Jaipur",
            destination: plan.destination || "Delhi",
            date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
            searched: false,
            selectedTrain: "Intercity Express",
            passengerName: "Demo Passenger",
            passengerAge: "20",
            documentType: plan.documentType || "",
            documentSample: "",
            wifiNetwork: "Campus Wi-Fi",
            wifiConnected: false,
            brightness: 50,
            bluetooth: false,
            travelClass: "SL",
            quota: "GN",
            passengerGender: "Male",
            passengerBerth: "No Preference",
            documentYear: "2025-26",
            upiId: "demoshop@demobank",
            upiAmount: "100",
            upiNote: "",
            emailTo: "teacher@example.com",
            emailSubject: "Assignment submission",
            emailBody: "Dear Sir/Madam,\n\nPlease find my assignment attached.\n\nThank you.",
            emailAttached: false,
            chatCaption: "Look at this!"
        };
    };
    resetState();

    function workflowStepTitle(target) {
        const titles = isHindi ? {
            trainSource: "शुरुआती शहर", trainDestination: "गंतव्य शहर", trainDate: "यात्रा की तारीख", trainSearch: "नमूना ट्रेनें खोजें", trainSelect: "ट्रेन चुनें", trainPassenger: "यात्री का विवरण", trainReview: "यात्रा की समीक्षा", bookingConfirm: "डेमो बुकिंग पूरी करें",
            documentOpen: "Documents खोलें", documentCategory: "दस्तावेज़ की श्रेणी चुनें", documentSample: "नमूना दस्तावेज़ चुनें", documentPreview: "पूर्वावलोकन देखें", documentDownload: "डेमो पूरा करें",
            phoneTutorialChoice: "ट्यूटोरियल चुनें", phoneSettings: "Settings खोलें", phoneWifi: "Wi-Fi सेटिंग चुनें", phoneNetwork: "नेटवर्क चुनें", phoneConnect: "कनेक्ट करें", phoneConnected: "कनेक्शन देखें", phoneDisplay: "Display सेटिंग चुनें", phoneBrightness: "चमक बदलें", phoneBrightnessDone: "चमक की पुष्टि करें", phoneBluetooth: "Bluetooth सेटिंग चुनें", phoneToggle: "Bluetooth बदलें", phoneBluetoothDone: "स्थिति देखें",
            upiOpenApp: "पेमेंट ऐप खोलें", upiChooseMethod: "भुगतान का तरीका चुनें", upiEnterId: "UPI ID दर्ज करें", upiEnterAmount: "रकम दर्ज करें", upiSelectAccount: "बैंक खाता चुनें", upiEnterPin: "UPI PIN चरण", upiSuccess: "भुगतान की पुष्टि देखें",
            emailCompose: "Compose चुनें", emailTo: "पाने वाले का पता लिखें", emailSubject: "Subject लिखें", emailBody: "संदेश लिखें", emailAttach: "फ़ाइल अटैच करें", emailSend: "ईमेल भेजें", emailSent: "भेजे जाने की पुष्टि देखें",
            chatOpenChat: "चैट खोलें", chatAttach: "Attach बटन दबाएँ", chatGallery: "Gallery चुनें", chatPickPhoto: "फोटो चुनें", chatCaption: "कैप्शन लिखें", chatSend: "फोटो भेजें", chatSent: "डिलीवरी देखें"
        } : {
            trainSource: "Enter your starting city", trainDestination: "Enter your destination", trainDate: "Choose a travel date", trainSearch: "Search sample trains", trainSelect: "Choose a train", trainPassenger: "Enter passenger details", trainReview: "Review the journey", bookingConfirm: "Complete the demo booking",
            documentOpen: "Open Documents", documentCategory: "Choose a document category", documentSample: "Choose a sample document", documentPreview: "Review the preview", documentDownload: "Finish the demo",
            phoneTutorialChoice: "Choose a tutorial", phoneSettings: "Open Settings", phoneWifi: "Choose Wi-Fi settings", phoneNetwork: "Choose a network", phoneConnect: "Connect to the sample network", phoneConnected: "Check the connection", phoneDisplay: "Open Display settings", phoneBrightness: "Adjust screen brightness", phoneBrightnessDone: "Check the brightness", phoneBluetooth: "Open Bluetooth settings", phoneToggle: "Turn Bluetooth on or off", phoneBluetoothDone: "Check Bluetooth status",
            upiOpenApp: "Open the payments app", upiChooseMethod: "Choose how to pay", upiEnterId: "Enter the UPI ID", upiEnterAmount: "Enter the amount", upiSelectAccount: "Choose the bank account", upiEnterPin: "UPI PIN step", upiSuccess: "Check the payment result",
            emailCompose: "Select Compose", emailTo: "Enter the recipient", emailSubject: "Write a subject", emailBody: "Write your message", emailAttach: "Attach a file", emailSend: "Send the email", emailSent: "Check it was sent",
            chatOpenChat: "Open the chat", chatAttach: "Tap the attach button", chatGallery: "Choose Gallery", chatPickPhoto: "Pick a photo", chatCaption: "Write a caption", chatSend: "Send the photo", chatSent: "Check delivery"
        };
        return titles[target] || (isHindi ? "यह चरण पूरा करें" : "Complete this step");
    }

    let guide = document.getElementById("guidePanel");
    if (!guide) {
        guide = document.createElement("section");
        guide.id = "guidePanel";
        guide.className = "guide-panel";
        document.querySelector(".hero").after(guide);
    }
    guide.style.display = "block";
    guide.innerHTML = `
        <div class="workflow-guide">
            <header class="workflow-header">
                <p class="tagline">${isHindi ? "रास्ता इंटरैक्टिव गाइड" : "RAASTA INTERACTIVE GUIDE"}</p>
                <h2>${isHindi ? "आइए, साथ में पूरा करें" : "Let’s work through it together"}</h2>
                <p class="guide-task"></p>
                <p class="simulation-note">${({
                    upi_payment: isHindi ? "यह केवल एक सिमुलेशन है। कोई वास्तविक पैसा नहीं भेजा जाएगा और कोई UPI PIN दर्ज या सेव नहीं होगा।" : "SIMULATION ONLY · No real money is sent and no UPI PIN is entered or stored.",
                    email_attachment: isHindi ? "यह केवल एक सिमुलेशन है। कोई वास्तविक ईमेल नहीं भेजा जाएगा और कोई फ़ाइल इस पेज से बाहर नहीं जाएगी।" : "SIMULATION ONLY · No real email is sent and no file leaves this page.",
                    chat_message: isHindi ? "यह केवल एक सिमुलेशन है। कोई वास्तविक संदेश या फोटो नहीं भेजी जाएगी।" : "SIMULATION ONLY · No real message or photo is sent."
                })[plan.category] || (isHindi ? "यह केवल एक सिमुलेशन है। कोई वास्तविक टिकट बुक, दस्तावेज़ डाउनलोड या डिवाइस सेटिंग नहीं बदली जाएगी।" : "SIMULATION ONLY · No real ticket is booked, document downloaded, or device setting changed.")}</p>
            </header>
            <div class="workflow-layout">
                <section class="workflow-simulator" aria-label="${isHindi ? "सिम्युलेटेड अभ्यास" : "Simulated practice"}">
                    <div class="workflow-device-header"><span>${({ train_booking: "🚆", document_download: "📁", upi_payment: "💳", email_attachment: "✉️", chat_message: "💬" })[plan.category] || "📱"}</span><strong class="workflow-app-title"></strong><span class="demo-badge">${isHindi ? "डेमो" : "DEMO"}</span></div>
                    <div class="workflow-screen" aria-live="polite"></div>
                </section>
                <aside class="workflow-instructions">
                    <div class="raasta-avatar">🧭</div><p class="tagline">${isHindi ? "रास्ता कहता है" : "RAASTA SAYS"}</p>
                    <div class="progress-bar" role="progressbar" aria-label="${isHindi ? "प्रगति" : "Guide progress"}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill"></div></div>
                    <p class="step-count"></p><h3 class="workflow-step-title" aria-live="polite"></h3><p id="workflowInstruction" class="workflow-instruction" aria-live="polite"></p><p class="guidance-detail" aria-live="polite"></p>
                    <div class="workflow-controls">
                        <button id="workflowSpeak" class="voice-btn repeat-instruction" type="button" aria-label="${isHindi ? "वर्तमान निर्देश फिर से सुनें" : "Repeat current instruction"}">🔊 ${isHindi ? "निर्देश फिर सुनें" : "Repeat instruction"}</button>
                        <div class="visual-navigation"><button id="workflowPrevious" class="voice-btn" type="button">← ${isHindi ? "पिछला" : "Previous"}</button><button id="workflowNext" class="start-btn" type="button">${isHindi ? "अगला →" : "Next →"}</button></div>
                        <button id="workflowRestart" class="voice-btn" type="button">↻ ${isHindi ? "फिर से शुरू करें" : "Restart"}</button>
                        <button id="workflowHelp" class="voice-btn" type="button">? ${isHindi ? "कंट्रोल नहीं मिल रहा?" : "Can't find the control?"}</button>
                    </div>
                    <p class="help-hint">${isHindi ? "हाइलाइट किए गए कंट्रोल को सिम्युलेटर में देखें। न मिले तो अगला चरण चुनें या फिर से शुरू करें।" : "Look for the highlighted control in the simulation. If you cannot find it, use Next or restart the guide."}</p>
                    <p class="workflow-feedback" aria-live="polite"></p>
                </aside>
            </div>
        </div>`;
    guide.querySelector(".guide-task").textContent = (isHindi ? "आपका काम: " : "Your task: ") + task;
    const screen = guide.querySelector(".workflow-screen");
    const instruction = guide.querySelector(".workflow-instruction");
    const progress = guide.querySelector(".progress-fill");
    const stepCount = guide.querySelector(".step-count");
    const previous = guide.querySelector("#workflowPrevious");
    const next = guide.querySelector("#workflowNext");
    const feedback = guide.querySelector(".workflow-feedback");
    const stepTitle = guide.querySelector(".workflow-step-title");
    const stepDetail = guide.querySelector(".guidance-detail");

    function documentLabel(type) {
        return ({
            bonafide: isHindi ? "बोनाफाइड प्रमाणपत्र" : "Bonafide Certificate",
            marksheet: isHindi ? "मार्कशीट" : "Marksheet",
            id_card: isHindi ? "ID कार्ड" : "ID Card",
            fee_receipt: isHindi ? "फीस रसीद" : "Fee Receipt"
        })[type] || (isHindi ? "बोनाफाइड प्रमाणपत्र" : "Bonafide Certificate");
    }

    function escapeWorkflowText(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
        })[character]);
    }

    const tr = (english, hindi) => (isHindi ? hindi : english);
    const esc = value => escapeWorkflowText(value);
    const trainClasses = {
        SL: { label: tr("Sleeper (SL)", "स्लीपर (SL)"), fare: 305, seats: "AVAILABLE 042" },
        "3A": { label: tr("Third AC (3A)", "थर्ड AC (3A)"), fare: 815, seats: "AVAILABLE 018" },
        "2A": { label: tr("Second AC (2A)", "सेकंड AC (2A)"), fare: 1160, seats: "RAC 006" }
    };
    const trainQuotas = { GN: tr("General", "सामान्य"), LD: tr("Ladies", "महिला"), TQ: tr("Tatkal", "तत्काल") };
    const optionList = (items, selected) => Object.entries(items).map(([value, label]) =>
        `<option value="${value}"${value === selected ? " selected" : ""}>${typeof label === "string" ? label : label.label}</option>`).join("");

    const phoneShell = (title, inner) => `<div class="sim-phone"><div class="phone-status">9:41 ▪▪▪</div><div class="phone-appbar"><span aria-hidden="true">←</span><strong>${title}</strong></div>${inner}</div>`;
    const simSwitch = (id, on, label) => `<button id="${id}" class="sim-switch${on ? " is-on" : ""}" type="button" role="switch" aria-checked="${on ? "true" : "false"}" aria-label="${label}"><span class="sim-switch-knob"></span></button>`;
    const staticSwitch = on => `<span class="sim-switch is-static${on ? " is-on" : ""}" aria-hidden="true"><span class="sim-switch-knob"></span></span>`;

    function renderTrainStage(target) {
        guide.querySelector(".workflow-app-title").textContent = tr("Train Journey Demo", "रेल यात्रा डेमो");
        const cls = trainClasses[state.travelClass] || trainClasses.SL;
        const stepLabels = [tr("Search", "खोज"), tr("Select train", "ट्रेन चुनें"), tr("Passengers", "यात्री"), tr("Review", "समीक्षा"), tr("Payment", "भुगतान")];
        const site = (stepIndex, inner) => `<div class="sim-site"><div class="sim-site-header"><strong>🚆 ${tr("Rail Booking", "रेल बुकिंग")}</strong><span class="sim-site-nav"><span class="nav-active">${tr("Book Ticket", "टिकट बुक करें")}</span><span>${tr("PNR Status", "PNR स्थिति")}</span><span>${tr("Train Schedule", "ट्रेन समय सारणी")}</span></span><span class="sim-site-user">👤 ${tr("Demo User", "डेमो यूज़र")}</span></div><div class="sim-site-body"><ol class="sim-stepper" aria-hidden="true">${stepLabels.map((label, index) => `<li class="${index === stepIndex ? "is-current" : index < stepIndex ? "is-done" : ""}">${label}</li>`).join("")}</ol>${inner}</div></div>`;
        const classChips = extraFare => Object.entries(trainClasses).map(([code, item]) => `<span class="class-chip${code === state.travelClass ? " is-selected" : ""}"><b>${code}</b> ₹${item.fare + extraFare}<small>${item.seats}</small></span>`).join("");
        const trainCard = (number, name, depart, arrive, duration, extraFare) => `<strong>${number} · ${name}</strong><span class="train-times"><b>${depart}</b> ${esc(state.source)} <i>── ${duration} ──</i> <b>${arrive}</b> ${esc(state.destination)}</span><span class="train-runs">${tr("Runs on", "चलती है")}: ${tr("Daily", "प्रतिदिन")}</span><span class="class-chips">${classChips(extraFare)}</span>`;
        if (["trainSource", "trainDestination", "trainDate", "trainSearch"].includes(target)) {
            return site(0, `<h3>${tr("Book Ticket", "टिकट बुक करें")}</h3><div class="journey-grid"><label>${tr("From", "कहाँ से")}<input id="trainSource" type="text" autocomplete="off" aria-label="${tr("Starting city", "शुरुआती शहर")}"></label><label>${tr("To", "कहाँ तक")}<input id="trainDestination" type="text" autocomplete="off" aria-label="${tr("Destination city", "गंतव्य शहर")}"></label><label>${tr("Journey date", "यात्रा की तारीख")}<input id="trainDate" type="date" aria-label="${tr("Travel date", "यात्रा की तारीख")}"></label><label>${tr("Class", "श्रेणी (Class)")}<select id="trainClass" aria-label="${tr("Class", "श्रेणी")}">${optionList(trainClasses, state.travelClass)}</select></label><label>${tr("Quota", "कोटा")}<select id="trainQuota" aria-label="${tr("Quota", "कोटा")}">${optionList(trainQuotas, state.quota)}</select></label></div><button id="trainSearch" class="workflow-action" type="button">🔎 ${tr("Search trains", "ट्रेनें खोजें")}</button><p class="workflow-muted">${tr("Sample trains and fares only. Nothing here is real.", "केवल नमूना ट्रेनें और किराए। यहाँ कुछ भी वास्तविक नहीं है।")}</p>`);
        }
        if (target === "trainSelect") {
            return site(1, `<h3>${tr("Available trains", "उपलब्ध ट्रेनें")}</h3><p class="workflow-muted">${esc(state.source)} → ${esc(state.destination)} · ${esc(state.date)} · ${trainQuotas[state.quota]}</p><button id="trainSelect" class="workflow-choice train-card active-choice" type="button">${trainCard("12987", "Intercity Express", "08:30", "14:15", "5h 45m", 0)}</button><button class="workflow-choice train-card" type="button" data-train="Superfast Express">${trainCard("22461", "Superfast Express", "10:10", "15:40", "5h 30m", 120)}</button><p class="workflow-muted">${tr("Check the seat status (AVAILABLE or RAC) before you book. Fares shown are demo values.", "बुक करने से पहले सीट की स्थिति (AVAILABLE या RAC) देखें। दिखाए गए किराए डेमो मान हैं।")}</p>`);
        }
        if (target === "trainPassenger") {
            return site(2, `<h3>${tr("Passenger details", "यात्री का विवरण")}</h3><p class="workflow-muted">${tr("These details stay in this browser simulation only.", "यह जानकारी केवल इस ब्राउज़र के डेमो में रहती है।")}</p><div class="journey-grid"><label>${tr("Name", "नाम")}<input id="passengerName" type="text" autocomplete="off"></label><label>${tr("Age", "उम्र")}<input id="passengerAge" type="number" min="1" max="120"></label><label>${tr("Gender", "लिंग")}<select id="passengerGender"><option value="Male">${tr("Male", "पुरुष")}</option><option value="Female">${tr("Female", "महिला")}</option><option value="Other">${tr("Other", "अन्य")}</option></select></label><label>${tr("Berth preference", "बर्थ की पसंद")}<select id="passengerBerth"><option value="No Preference">${tr("No preference", "कोई पसंद नहीं")}</option><option value="Lower">${tr("Lower", "लोअर")}</option><option value="Middle">${tr("Middle", "मिडिल")}</option><option value="Upper">${tr("Upper", "अपर")}</option></select></label></div><button id="trainPassenger" class="workflow-action" type="button">${tr("Save demo details", "विवरण सहेजें")}</button>`);
        }
        if (target === "trainReview") {
            const fare = cls.fare, reservation = 40, total = fare + reservation;
            return site(3, `<h3>${tr("Review booking", "बुकिंग की समीक्षा")}</h3><dl class="workflow-summary"><dt>${tr("Journey", "यात्रा")}</dt><dd>${esc(state.source)} → ${esc(state.destination)}</dd><dt>${tr("Date", "तारीख")}</dt><dd>${esc(state.date)}</dd><dt>${tr("Train", "ट्रेन")}</dt><dd>${esc(state.selectedTrain)}</dd><dt>${tr("Class · Quota", "श्रेणी · कोटा")}</dt><dd>${cls.label} · ${trainQuotas[state.quota]}</dd><dt>${tr("Passenger", "यात्री")}</dt><dd>${esc(state.passengerName)}, ${esc(state.passengerAge)}, ${esc(state.passengerGender)} · ${esc(state.passengerBerth)}</dd><dt>${tr("Base fare (demo)", "मूल किराया (डेमो)")}</dt><dd>₹${fare}</dd><dt>${tr("Reservation charge (demo)", "आरक्षण शुल्क (डेमो)")}</dt><dd>₹${reservation}</dd><dt>${tr("Total (demo)", "कुल (डेमो)")}</dt><dd><strong>₹${total}</strong></dd></dl><p class="workflow-muted">${tr("Check every detail now. No payment will be taken in this demo.", "अभी हर विवरण जाँच लें। इस डेमो में कोई भुगतान नहीं लिया जाएगा।")}</p>`);
        }
        const payable = (trainClasses[state.travelClass] || trainClasses.SL).fare + 40;
        return site(4, `<h3>${tr("Payment", "भुगतान")}</h3><p class="workflow-muted">${tr("Choose how you would pay. In this demo nothing is charged.", "चुनें कि आप कैसे भुगतान करते। इस डेमो में कुछ भी चार्ज नहीं होता।")}</p><div class="setting-row setting-decoy pay-method is-selected">◉ ${tr("UPI", "UPI")}<span>${tr("Demo", "डेमो")}</span></div><div class="setting-row setting-decoy pay-method">○ ${tr("Debit / credit card", "डेबिट / क्रेडिट कार्ड")}<span>${tr("Demo", "डेमो")}</span></div><div class="setting-row setting-decoy pay-method">○ ${tr("Net banking", "नेट बैंकिंग")}<span>${tr("Demo", "डेमो")}</span></div><p class="pay-total">${tr("Amount payable", "देय राशि")}: <strong>₹${payable}</strong></p><button id="bookingConfirm" class="workflow-action" type="button">✓ ${tr("Pay", "भुगतान करें")} ₹${payable} (${tr("demo", "डेमो")})</button><p class="workflow-muted">${tr("In a real booking you would enter your payment details privately here. This is practice only; no real ticket will be reserved.", "असली बुकिंग में आप यहाँ अपने भुगतान विवरण निजी तौर पर डालते। यह केवल अभ्यास है; कोई वास्तविक टिकट आरक्षित नहीं होगा।")}</p>`);
    }

    function renderDocumentStage(target) {
        guide.querySelector(".workflow-app-title").textContent = tr("Documents Demo", "Documents डेमो");
        const onDashboard = target === "documentOpen";
        const navItems = [["🏠", tr("Dashboard", "डैशबोर्ड")], ["👤", tr("My Profile", "मेरी प्रोफ़ाइल")], ["📁", tr("Documents", "दस्तावेज़")], ["💳", tr("Fee Details", "फीस विवरण")], ["📝", tr("Examinations", "परीक्षा")], ["📚", tr("Library", "पुस्तकालय")]];
        const nav = navItems.map(([icon, label], index) => {
            if (index === 2 && onDashboard) return `<button id="documentOpen" class="portal-option" type="button">${icon} ${label}</button>`;
            const current = (index === 0 && onDashboard) || (index === 2 && !onDashboard);
            return `<button class="portal-option${current ? " nav-current" : ""}" type="button"${current ? ' aria-current="page"' : ""}>${icon} ${label}</button>`;
        }).join("");
        const portal = inner => `<div class="portal"><div class="portal-header"><strong>🎓 ${tr("Student Portal", "छात्र पोर्टल")}</strong><span>${tr("Demo Student Account · Enrolment DEMO-2025-0042 · Semester 1", "डेमो छात्र खाता · नामांकन DEMO-2025-0042 · सेमेस्टर 1")}</span></div><div class="portal-body"><aside class="portal-sidebar"><p>${tr("MAIN MENU", "मुख्य मेन्यू")}</p>${nav}</aside><div class="portal-main">${inner}</div></div></div>`;
        const issued = tr("12 Aug 2025", "12 अग॰ 2025");
        if (target === "documentOpen") return portal(`<h3>${tr("Welcome back, Demo Student", "वापसी पर स्वागत है, Demo Student")}</h3><p>${tr("Semester 1 · Academic year 2025–26", "सेमेस्टर 1 · शैक्षणिक वर्ष 2025–26")}</p><div class="stat-row"><div class="stat"><strong>86%</strong><span>${tr("Attendance (demo)", "उपस्थिति (डेमो)")}</span></div><div class="stat"><strong>₹0</strong><span>${tr("Fees due (demo)", "बकाया फीस (डेमो)")}</span></div><div class="stat"><strong>2</strong><span>${tr("New notices", "नई सूचनाएँ")}</span></div></div><div class="document-card"><div class="document-icon">📢</div><div><strong>${tr("Notice", "सूचना")}</strong><p>${tr("Mid-semester exam schedule will be published soon. (sample)", "मध्य-सेमेस्टर परीक्षा का कार्यक्रम जल्द प्रकाशित होगा। (नमूना)")}</p></div></div>`);
        if (target === "documentCategory") return portal(`<h3>${tr("My Documents", "मेरे दस्तावेज़")}</h3><p>${tr("Choose the year and the type of document you need.", "वर्ष और जिस प्रकार का दस्तावेज़ चाहिए, वह चुनें।")}</p><div class="journey-grid"><label>${tr("Academic year", "शैक्षणिक वर्ष")}<select id="documentYear" aria-label="${tr("Academic year", "शैक्षणिक वर्ष")}"><option value="2025-26">2025–26</option><option value="2024-25">2024–25</option></select></label><label>${tr("Category", "श्रेणी")}<select id="documentCategory" aria-label="${tr("Document category", "दस्तावेज़ की श्रेणी")}"><option value="">${tr("Choose a category", "श्रेणी चुनें")}</option><option value="bonafide">${documentLabel("bonafide")}</option><option value="marksheet">${documentLabel("marksheet")}</option><option value="id_card">${documentLabel("id_card")}</option><option value="fee_receipt">${documentLabel("fee_receipt")}</option></select></label></div><div class="empty-state">${tr("Select a category to see the documents available for you.", "आपके लिए उपलब्ध दस्तावेज़ देखने के लिए श्रेणी चुनें।")}</div>`);
        if (target === "documentSample") return portal(`<h3>${tr("My Documents", "मेरे दस्तावेज़")}</h3><p>${esc(state.documentYear)} · ${documentLabel(state.documentType)}</p><div class="doc-table"><div class="doc-row doc-head"><span>${tr("Document", "दस्तावेज़")}</span><span>${tr("Issued", "जारी")}</span><span>${tr("Size", "आकार")}</span><span></span></div><div class="doc-row"><span>📄 ${documentLabel(state.documentType)}</span><span>${issued}</span><span>120 KB</span><button id="documentSample" class="portal-action active-choice" type="button">${tr("View", "देखें")} →</button></div></div><p class="workflow-muted">${tr("Demo student record · sample · Ref DEMO/2025/0042 · PDF", "डेमो छात्र रिकॉर्ड · नमूना · संदर्भ DEMO/2025/0042 · PDF")}</p>`);
        const preview = `<div class="sample-document"><span>🎓 RAASTA · DEMO</span><strong>${documentLabel(state.documentType)}</strong><p>${tr("Sample student document", "नमूना छात्र दस्तावेज़")}</p><small>${tr("Academic year", "शैक्षणिक वर्ष")} ${esc(state.documentYear)} · ${tr("Ref", "संदर्भ")} DEMO/2025/0042</small><small>${tr("SIMULATION ONLY", "केवल सिमुलेशन")}</small></div>`;
        if (target === "documentPreview") return portal(`<h3>${tr("Document preview", "दस्तावेज़ का पूर्वावलोकन")}</h3><div class="preview-toolbar"><span>${documentLabel(state.documentType)}.pdf</span><span>${tr("Page 1 of 1", "पृष्ठ 1 / 1")}</span></div>${preview}<button id="documentPreview" class="workflow-action" type="button">${tr("Preview checked", "पूर्वावलोकन देखा")}</button>`);
        return portal(`<h3>${tr("Download document", "दस्तावेज़ डाउनलोड करें")}</h3><div class="preview-toolbar"><span>${documentLabel(state.documentType)}.pdf</span><span>120 KB</span></div>${preview}<button id="documentDownload" class="workflow-action" type="button">⬇ ${tr("Download PDF (demo)", "PDF डाउनलोड करें (डेमो)")}</button><p class="workflow-muted">${tr("In a real portal the PDF would save to your Downloads folder. No real institutional document will be downloaded.", "असली पोर्टल में PDF आपके Downloads फ़ोल्डर में सेव होता। कोई वास्तविक संस्थागत दस्तावेज़ डाउनलोड नहीं होगा।")}</p>`);
    }

    function renderPhoneStage(target) {
        guide.querySelector(".workflow-app-title").textContent = tr("Phone Settings Demo", "फोन Settings डेमो");
        const topic = plan.topic || "";
        const entry = topic === "brightness"
            ? [tr("Display", "Display"), tr("Brightness, dark theme", "चमक, डार्क थीम")]
            : topic === "bluetooth"
                ? [tr("Connected devices", "Connected devices"), tr("Bluetooth, pairing", "Bluetooth, पेयरिंग")]
                : [tr("Network and display settings", "नेटवर्क और डिस्प्ले सेटिंग्स"), tr("Wi-Fi, display", "Wi-Fi, डिस्प्ले")];
        if (target === "phoneTutorialChoice") return `<h3>${tr("Which setting would you like to learn?", "किस सेटिंग के बारे में सीखेंगे?")}</h3><div id="phoneTutorialChoice" class="phone-tutorial-choices"><button type="button" data-phone-topic="wifi">📶 ${tr("Connect to Wi-Fi", "Wi-Fi जोड़ें")}</button><button type="button" data-phone-topic="brightness">☀️ ${tr("Adjust brightness", "चमक बदलें")}</button><button type="button" data-phone-topic="bluetooth">ᛒ ${tr("Turn Bluetooth on/off", "Bluetooth चालू/बंद करें")}</button></div>`;
        if (target === "phoneSettings") return `<div class="phone-settings-screen"><div class="phone-status">9:41 ▪▪▪</div><h3>⚙️ Settings</h3><p>${tr("This is a simulated phone settings screen.", "यह फोन का सिम्युलेटेड Settings पेज है।")}</p><div class="setting-search">🔍 ${tr("Search settings", "सेटिंग खोजें")}</div><button id="phoneSettings" class="workflow-choice active-choice" type="button">${entry[0]} →<span>${entry[1]}</span></button><div class="setting-row setting-decoy">🔊 ${tr("Sound & vibration", "आवाज़ और वाइब्रेशन")} <span>›</span></div><div class="setting-row setting-decoy">🔋 ${tr("Battery", "बैटरी")} <span>›</span></div><div class="setting-row setting-decoy">🔔 ${tr("Notifications", "नोटिफ़िकेशन")} <span>›</span></div></div>`;
        if (target === "phoneWifi") return phoneShell("Network &amp; Internet", `<button id="phoneWifi" class="setting-row active-choice" type="button"><span>📶 Wi-Fi</span><span>${tr("On", "चालू")} →</span></button><div class="setting-row setting-decoy">📡 ${tr("Mobile network", "मोबाइल नेटवर्क")} <span>›</span></div><div class="setting-row setting-decoy">🔥 ${tr("Hotspot & tethering", "हॉटस्पॉट")} <span>›</span></div><div class="setting-row setting-decoy">✈️ ${tr("Airplane mode", "एयरप्लेन मोड")} ${staticSwitch(false)}</div>`);
        if (target === "phoneNetwork") return phoneShell("Wi-Fi", `<div class="setting-row setting-decoy">${tr("Use Wi-Fi", "Wi-Fi इस्तेमाल करें")} ${staticSwitch(true)}</div><p class="workflow-muted">${tr("Available networks", "उपलब्ध नेटवर्क")}</p><button id="phoneNetwork" class="setting-row active-choice" type="button">🔒 Campus Wi-Fi <span>▂▄▆</span></button><div class="setting-row setting-decoy">🔒 Home_Net_5G <span>▂▄</span></div><div class="setting-row setting-decoy">📶 Library_Guest <span>▂</span></div><p class="workflow-muted">${tr("This is a sample network.", "यह एक नमूना नेटवर्क है।")}</p>`);
        if (target === "phoneConnect") return phoneShell("Campus Wi-Fi", `<label>${tr("Password (demo only)", "पासवर्ड (केवल डेमो)")}<input type="password" value="demo-password" disabled aria-readonly="true"></label><div class="setting-row setting-decoy">${tr("Show password", "पासवर्ड दिखाएँ")} <span>☐</span></div><p class="workflow-muted">${tr("The demo fills this in for you. Never share a real Wi-Fi password.", "डेमो इसे अपने आप भर देता है। असली Wi-Fi पासवर्ड कभी साझा न करें।")}</p><div class="dialog-actions"><span class="dialog-cancel">${tr("Cancel", "रद्द करें")}</span><button id="phoneConnect" class="workflow-action" type="button">Connect</button></div>`);
        if (target === "phoneConnected") return phoneShell("Wi-Fi", `<div class="setting-row setting-result">📶 Campus Wi-Fi <strong>${state.wifiConnected ? tr("Connected", "जुड़ा हुआ") : tr("Ready", "तैयार")}</strong></div><p class="workflow-muted">${tr("Signal: Excellent · Link speed: 72 Mbps (demo)", "सिग्नल: बहुत अच्छा · स्पीड: 72 Mbps (डेमो)")}</p><button id="phoneConnected" class="workflow-action" type="button">${tr("Check status", "स्थिति देखें")}</button>`);
        if (target === "phoneDisplay") return phoneShell(tr("Display settings", "Display सेटिंग्स"), `<button id="phoneDisplay" class="setting-row active-choice" type="button">☀️ ${tr("Brightness", "चमक")} →</button><div class="setting-row setting-decoy">🌙 ${tr("Dark theme", "डार्क थीम")} ${staticSwitch(false)}</div><div class="setting-row setting-decoy">🔠 ${tr("Font size", "फ़ॉन्ट आकार")} <span>›</span></div>`);
        if (target === "phoneBrightness") return phoneShell(tr("Brightness", "चमक"), `<div class="slider-row"><span aria-hidden="true">🔅</span><input id="phoneBrightness" type="range" min="0" max="100" value="${state.brightness}" aria-label="${tr("Screen brightness", "स्क्रीन की चमक")}"><span aria-hidden="true">🔆</span></div><p class="workflow-muted">${state.brightness}%</p><div class="setting-row setting-decoy">🌗 ${tr("Adaptive brightness", "एडैप्टिव ब्राइटनेस")} ${staticSwitch(false)}</div>`);
        if (target === "phoneBrightnessDone") return phoneShell(tr("Brightness", "चमक"), `<div class="setting-row setting-result">☀️ ${tr("Screen level", "स्क्रीन स्तर")}<strong>${state.brightness}%</strong></div><button id="phoneBrightnessDone" class="workflow-action" type="button">${tr("Finish tutorial", "पूरा करें")}</button>`);
        if (target === "phoneBluetooth") return phoneShell("Connected devices", `<button id="phoneBluetooth" class="setting-row active-choice" type="button">ᛒ Bluetooth <span>${state.bluetooth ? "On" : "Off"} →</span></button><div class="setting-row setting-decoy">🎧 Demo Headphones <span>${tr("Saved", "सेव किया हुआ")}</span></div><div class="setting-row setting-decoy">➕ ${tr("Pair new device", "नया डिवाइस जोड़ें")} <span>›</span></div>`);
        if (target === "phoneToggle") return phoneShell("Bluetooth", `<div class="setting-row"><span>${tr("Use Bluetooth", "Bluetooth इस्तेमाल करें")}</span>${simSwitch("phoneToggle", state.bluetooth, state.bluetooth ? tr("Turn off", "बंद करें") : tr("Turn on", "चालू करें"))}</div><p class="workflow-muted">${tr("When Bluetooth is on, your phone can find and connect to nearby devices.", "Bluetooth चालू होने पर फोन पास के डिवाइस ढूँढकर जुड़ सकता है।")}</p><p class="workflow-muted">${tr("Tap the switch to turn Bluetooth on or off.", "Bluetooth चालू या बंद करने के लिए स्विच दबाएँ।")}</p>`);
        return phoneShell("Bluetooth", `<div class="setting-row setting-result">ᛒ Bluetooth <strong>${state.bluetooth ? "On" : "Off"}</strong></div><button id="phoneBluetoothDone" class="workflow-action" type="button">${tr("Finish tutorial", "पूरा करें")}</button>`);
    }

    function renderUpiStage(target) {
        guide.querySelector(".workflow-app-title").textContent = tr("Payments App Demo", "पेमेंट ऐप डेमो");
        const amount = esc(state.upiAmount);
        const frame = (inner) => `<div class="sim-phone"><div class="phone-status">9:41 ▪▪▪</div>${inner}</div>`;
        if (target === "upiOpenApp") return frame(`<h3>${tr("Home screen", "होम स्क्रीन")}</h3><div class="app-grid"><button id="upiOpenApp" class="app-icon active-choice" type="button"><span>💳</span>${tr("Pay", "Pay")}</button><span class="app-icon setting-decoy"><span>📷</span>${tr("Camera", "कैमरा")}</span><span class="app-icon setting-decoy"><span>🖼️</span>${tr("Gallery", "गैलरी")}</span><span class="app-icon setting-decoy"><span>⚙️</span>${tr("Settings", "Settings")}</span></div>`);
        if (target === "upiChooseMethod") return frame(`<h3>${tr("Pay", "भुगतान करें")}</h3><div class="setting-row setting-decoy">📷 ${tr("Scan any QR code", "कोई भी QR कोड स्कैन करें")} <span>›</span></div><div class="setting-row setting-decoy">👤 ${tr("Pay contacts", "संपर्कों को भुगतान")} <span>›</span></div><button id="upiChooseMethod" class="setting-row active-choice" type="button">🔢 ${tr("Pay UPI ID or number", "Pay UPI ID or number")} →</button><div class="setting-row setting-decoy">🏦 ${tr("Bank transfer", "बैंक ट्रांसफ़र")} <span>›</span></div>`);
        if (target === "upiEnterId") return frame(`<h3>${tr("Pay UPI ID or number", "UPI ID या नंबर पर भुगतान")}</h3><label>${tr("UPI ID", "UPI ID")}<input id="upiEnterId" type="text" autocomplete="off" aria-label="UPI ID"></label><div class="payee-card">✅ <strong>Demo Shop</strong><span>${tr("Name registered with the bank. Always check this name before you pay.", "बैंक में दर्ज नाम। भुगतान से पहले हमेशा यह नाम जाँचें।")}</span></div>`);
        if (target === "upiEnterAmount") return frame(`<h3>${tr("Paying Demo Shop", "Demo Shop को भुगतान")}</h3><label>${tr("Amount (₹)", "रकम (₹)")}<input id="upiEnterAmount" type="number" min="1" inputmode="decimal" aria-label="${tr("Amount in rupees", "रुपये में रकम")}"></label><label>${tr("Add a note (optional)", "नोट जोड़ें (वैकल्पिक)")}<input id="upiNote" type="text" autocomplete="off"></label>`);
        if (target === "upiSelectAccount") return frame(`<h3>${tr("Pay ₹", "भुगतान ₹")}${amount}</h3><p class="workflow-muted">${tr("Pay from", "इस खाते से भुगतान")}</p><button id="upiSelectAccount" class="setting-row active-choice" type="button">🏦 Demo Bank ••1234 <span>${tr("Savings", "बचत")} ✓</span></button><div class="setting-row setting-decoy">🏦 Sample Bank ••5678 <span>${tr("Savings", "बचत")}</span></div>`);
        if (target === "upiEnterPin") return frame(`<h3>${tr("Enter UPI PIN", "UPI PIN दर्ज करें")}</h3><div class="pin-dots" aria-hidden="true">● ● ● ●</div><p class="workflow-muted">${tr("Demo only: no PIN is typed or stored. In your real app, enter your own PIN privately and never tell it to anyone, not even a bank caller.", "केवल डेमो: कोई PIN टाइप या सेव नहीं होता। असली ऐप में अपना PIN खुद निजी तौर पर डालें और किसी को न बताएँ, बैंक का फोन करने वाले को भी नहीं।")}</p><button id="upiEnterPin" class="workflow-action" type="button">✓ ${tr("Confirm (demo)", "Confirm (डेमो)")}</button>`);
        return frame(`<div class="success-card"><div class="success-mark">✅</div><h3>${tr("Payment successful", "भुगतान सफल")}</h3><p><strong>₹${amount}</strong> ${tr("paid to", "को भुगतान किया:")} Demo Shop</p><p class="workflow-muted">${tr("From Demo Bank ••1234 · Demo ref DEMO-0001", "Demo Bank ••1234 से · डेमो संदर्भ DEMO-0001")}</p></div><button id="upiSuccess" class="workflow-action" type="button">${tr("Done", "पूरा हुआ")}</button>`);
    }

    function renderEmailStage(target) {
        guide.querySelector(".workflow-app-title").textContent = tr("Mail Demo", "Mail डेमो");
        const composeButton = target === "emailCompose"
            ? `<button id="emailCompose" class="mail-compose-btn" type="button">✏️ ${tr("Compose", "Compose")}</button>`
            : `<span class="mail-compose-btn is-static">✏️ ${tr("Compose", "Compose")}</span>`;
        const folders = `${composeButton}<div class="folder is-current">📥 ${tr("Inbox", "इनबॉक्स")} <b>2</b></div><div class="folder">⭐ ${tr("Starred", "स्टार वाले")}</div><div class="folder">📤 ${tr("Sent", "भेजे गए")}</div><div class="folder">📝 ${tr("Drafts", "ड्राफ़्ट")}</div>`;
        const inbox = `<div class="mail-list"><div class="mail-row is-unread"><strong>Demo Teacher</strong><span>${tr("Assignment reminder", "असाइनमेंट रिमाइंडर")} — ${tr("please send yours by Friday", "कृपया शुक्रवार तक भेजें")}</span><time>9:12</time></div><div class="mail-row is-unread"><strong>Demo Bank</strong><span>${tr("Statement ready", "स्टेटमेंट तैयार")} — ${tr("sample message", "नमूना संदेश")}</span><time>${tr("Yesterday", "कल")}</time></div><div class="mail-row"><strong>Demo Library</strong><span>${tr("Book due soon", "किताब जल्द लौटानी है")}</span><time>${tr("Mon", "सोम")}</time></div></div>`;
        const shell = (main, dim) => `<div class="sim-mail"><div class="mail-top"><strong>✉️ ${tr("Mail", "मेल")}</strong><span class="mail-search">🔍 ${tr("Search mail", "मेल खोजें")}</span><span aria-hidden="true">👤</span></div><div class="mail-body"><aside class="mail-folders">${folders}</aside><div class="mail-main${dim ? " is-dimmed" : ""}">${main}</div></div></div>`;
        if (target === "emailCompose") return shell(`<h3>${tr("Inbox", "इनबॉक्स")}</h3>${inbox}`, false);
        if (target === "emailSent") return shell(`<h3>${tr("Inbox", "इनबॉक्स")}</h3>${inbox}<div class="snackbar"><span>✅ ${tr("Message sent", "संदेश भेज दिया गया")} · ${tr("To", "प्राप्तकर्ता")}: ${esc(state.emailTo)} · 📎 ${state.emailAttached ? "Assignment.pdf" : tr("no attachment", "कोई अटैचमेंट नहीं")}</span><button id="emailSent" class="workflow-action" type="button">${tr("Done", "पूरा हुआ")}</button></div>`, false);
        const chip = state.emailAttached ? `<div class="attach-chip">📎 Assignment.pdf <span>240 KB</span></div>` : "";
        const attachHint = state.emailAttached ? "" : `<p class="workflow-muted">${tr("Demo file available: Assignment.pdf (240 KB)", "डेमो फ़ाइल उपलब्ध: Assignment.pdf (240 KB)")}</p>`;
        return shell(`<h3>${tr("Inbox", "इनबॉक्स")}</h3>${inbox}<div class="compose-window"><div class="compose-title"><span>${tr("New Message", "नया संदेश")}</span><span aria-hidden="true">— ✕</span></div><div class="compose-form"><label>${tr("To", "To")}<input id="emailTo" type="email" autocomplete="off" aria-label="${tr("Recipient email address", "पाने वाले का ईमेल पता")}"></label><label>${tr("Subject", "Subject")}<input id="emailSubject" type="text" autocomplete="off"></label><label>${tr("Message", "संदेश")}<textarea id="emailBody" rows="4"></textarea></label>${chip}${attachHint}<div class="compose-actions"><button id="emailSend" class="workflow-action" type="button">➤ ${tr("Send", "Send")}</button><button id="emailAttach" class="workflow-action" type="button">📎 ${tr("Attach files", "Attach files")}</button></div></div></div>`, true);
    }

    function renderChatStage(target) {
        guide.querySelector(".workflow-app-title").textContent = tr("Chat App Demo", "चैट ऐप डेमो");
        const frame = inner => `<div class="sim-phone"><div class="phone-status">9:41 ▪▪▪</div>${inner}</div>`;
        const tiles = [["🌄", "Sunset"], ["🌳", "Garden"], ["🍰", "Cake"], ["📚", "Books"]];
        const received = `<div class="chat-bubble received">${tr("Hi! Send me the photo from today?", "नमस्ते! आज वाली फोटो भेजोगे?")}</div>`;
        if (target === "chatOpenChat") return frame(`<h3>${tr("Chats", "चैट")}</h3><button id="chatOpenChat" class="setting-row active-choice" type="button">🟢 Demo Friend <span>${tr("Hi! Send me the photo…", "नमस्ते! फोटो भेजो…")}</span></button><div class="setting-row setting-decoy">👥 Demo Family Group <span>${tr("Dinner at 8?", "डिनर 8 बजे?")}</span></div><div class="setting-row setting-decoy">🎓 Demo Class Group <span>${tr("Notes uploaded", "नोट्स अपलोड हुए")}</span></div>`);
        if (target === "chatAttach") return frame(`<h3>Demo Friend</h3><div class="chat-thread">${received}</div><div class="chat-input-bar"><span class="chat-field">${tr("Type a message", "संदेश लिखें")}</span><button id="chatAttach" class="chat-icon active-choice" type="button" aria-label="${tr("Attach", "Attach")}">📎</button></div>`);
        if (target === "chatGallery") return frame(`<h3>${tr("Attach", "Attach करें")}</h3><div class="attach-menu"><button id="chatGallery" class="app-icon active-choice" type="button"><span>🖼️</span>${tr("Gallery", "Gallery")}</button><span class="app-icon setting-decoy"><span>📷</span>${tr("Camera", "कैमरा")}</span><span class="app-icon setting-decoy"><span>📄</span>${tr("Document", "डॉक्यूमेंट")}</span><span class="app-icon setting-decoy"><span>📍</span>${tr("Location", "लोकेशन")}</span></div>`);
        if (target === "chatPickPhoto") return frame(`<h3>${tr("Gallery", "Gallery")}</h3><div class="photo-grid">${tiles.map(([emoji, name], index) => index === 0
            ? `<button id="chatPickPhoto" class="photo-tile active-choice" type="button"><span>${emoji}</span>${name}</button>`
            : `<span class="photo-tile setting-decoy"><span>${emoji}</span>${name}</span>`).join("")}</div>`);
        if (target === "chatCaption") return frame(`<h3>${tr("Send photo", "फोटो भेजें")}</h3><div class="photo-preview">🌄 Sunset</div><label>${tr("Add a caption", "कैप्शन जोड़ें")}<input id="chatCaption" type="text" autocomplete="off"></label>`);
        if (target === "chatSend") return frame(`<h3>${tr("Send photo", "फोटो भेजें")}</h3><div class="photo-preview">🌄 Sunset</div><p class="workflow-muted">${esc(state.chatCaption)}</p><button id="chatSend" class="workflow-action" type="button">➤ ${tr("Send", "Send")}</button>`);
        return frame(`<h3>Demo Friend</h3><div class="chat-thread">${received}<div class="chat-bubble sent"><div class="photo-preview small">🌄 Sunset</div>${esc(state.chatCaption)}<span class="ticks">✓✓</span></div></div><p class="workflow-muted">${tr("Two ticks mean the message was delivered.", "दो टिक का मतलब है कि संदेश पहुँच गया।")}</p><button id="chatSent" class="workflow-action" type="button">${tr("Done", "पूरा हुआ")}</button>`);
    }

    const fieldMap = {
        trainClass: "travelClass", trainQuota: "quota", passengerGender: "passengerGender", passengerBerth: "passengerBerth",
        documentYear: "documentYear", upiEnterId: "upiId", upiEnterAmount: "upiAmount", upiNote: "upiNote",
        emailTo: "emailTo", emailSubject: "emailSubject", emailBody: "emailBody", chatCaption: "chatCaption"
    };

    function renderStage() {
        const step = plan.steps[currentStep];
        const target = step.targetElementId;
        instruction.textContent = step.instruction;
        stepDetail.textContent = guidanceDetail(target, workflowStepTitle(target), isHindi);
        stepTitle.textContent = workflowStepTitle(target);
        stepCount.textContent = isHindi ? `चरण ${currentStep + 1} / ${plan.steps.length}` : `Step ${currentStep + 1} of ${plan.steps.length}`;
        progress.style.width = `${((currentStep + 1) / plan.steps.length) * 100}%`;
        guide.querySelector(".progress-bar").setAttribute("aria-valuenow", String(Math.round((currentStep + 1) / plan.steps.length * 100)));
        previous.disabled = currentStep === 0;
        next.textContent = currentStep === plan.steps.length - 1 ? (isHindi ? "समाप्त ✓" : "Finish ✓") : (isHindi ? "अगला →" : "Next →");
        feedback.textContent = "";
        if (plan.category === "train_booking") screen.innerHTML = renderTrainStage(target);
        else if (plan.category === "document_download") screen.innerHTML = renderDocumentStage(target);
        else if (plan.category === "upi_payment") screen.innerHTML = renderUpiStage(target);
        else if (plan.category === "email_attachment") screen.innerHTML = renderEmailStage(target);
        else if (plan.category === "chat_message") screen.innerHTML = renderChatStage(target);
        else screen.innerHTML = renderPhoneStage(target);

        const highlighted = guide.querySelector(`#${target}`);
        highlighted?.classList.add("active-target");
        highlighted?.setAttribute("aria-current", "step");
        const sourceInput = screen.querySelector("#trainSource");
        const destinationInput = screen.querySelector("#trainDestination");
        const dateInput = screen.querySelector("#trainDate");
        const nameInput = screen.querySelector("#passengerName");
        const ageInput = screen.querySelector("#passengerAge");
        const documentCategory = screen.querySelector("#documentCategory");
        const brightness = screen.querySelector("#phoneBrightness");
        if (sourceInput) sourceInput.value = state.source;
        if (destinationInput) destinationInput.value = state.destination;
        if (dateInput) dateInput.value = state.date;
        if (nameInput) nameInput.value = state.passengerName;
        if (ageInput) ageInput.value = state.passengerAge;
        if (documentCategory) documentCategory.value = state.documentType;
        if (brightness) brightness.value = state.brightness;
        Object.entries(fieldMap).forEach(([id, key]) => {
            const field = screen.querySelector(`#${id}`);
            if (field) field.value = state[key];
        });
        documentCategory?.addEventListener("change", () => { state.documentType = documentCategory.value; });
        brightness?.addEventListener("input", () => { state.brightness = Number(brightness.value); });
        screen.querySelectorAll("[data-phone-topic]").forEach(button => button.addEventListener("click", () => {
            const topic = button.dataset.phoneTopic;
            const targets = supportedWorkflowTargets.smartphone_basics[topic];
            plan = { ...plan, topic, steps: phoneTutorialSteps(topic, isHindi).map((item, index) => ({ ...item, targetElementId: targets[index] })) };
            currentStep = 0;
            renderStage();
        }));
        screen.querySelectorAll("[data-train]").forEach(button => button.addEventListener("click", () => { state.selectedTrain = button.dataset.train; }));
        const actionButton = screen.querySelector(`#${target}`);
        if (actionButton?.tagName === "BUTTON") actionButton.onclick = () => advanceStep();
    }

    function captureInputs() {
        const source = screen.querySelector("#trainSource");
        const destination = screen.querySelector("#trainDestination");
        const date = screen.querySelector("#trainDate");
        const name = screen.querySelector("#passengerName");
        const age = screen.querySelector("#passengerAge");
        if (source) state.source = source.value.trim() || state.source;
        if (destination) state.destination = destination.value.trim() || state.destination;
        if (date) state.date = date.value || state.date;
        if (name) state.passengerName = name.value.trim() || state.passengerName;
        if (age) state.passengerAge = age.value || state.passengerAge;
        const category = screen.querySelector("#documentCategory");
        if (category) state.documentType = category.value;
        const brightness = screen.querySelector("#phoneBrightness");
        if (brightness) state.brightness = Number(brightness.value);
        Object.entries(fieldMap).forEach(([id, key]) => {
            const field = screen.querySelector(`#${id}`);
            if (field && typeof field.value === "string") state[key] = key === "emailBody" ? field.value : field.value.trim();
        });
    }

    function finishWorkflow() {
        stopSpeech();
        if (activeGuidance) activeGuidance.completed = true;
        const message = plan.category === "train_booking"
            ? (isHindi ? "सिम्युलेटेड यात्रा पूरी हुई। कोई वास्तविक टिकट बुक या भुगतान नहीं हुआ।" : "Simulated journey complete. No real ticket was booked or paid for.")
            : plan.category === "document_download"
                ? (isHindi ? "डेमो पूरा हुआ। कोई वास्तविक संस्थागत दस्तावेज़ डाउनलोड नहीं हुआ।" : "Demo complete. No real institutional document was downloaded.")
                : plan.category === "upi_payment"
                    ? (isHindi ? "डेमो पूरा हुआ। कोई वास्तविक पैसा नहीं भेजा गया और कोई PIN दर्ज नहीं हुआ।" : "Demo complete. No real money was sent and no PIN was entered.")
                    : plan.category === "email_attachment"
                        ? (isHindi ? "डेमो पूरा हुआ। कोई वास्तविक ईमेल नहीं भेजा गया।" : "Demo complete. No real email was sent.")
                        : plan.category === "chat_message"
                            ? (isHindi ? "डेमो पूरा हुआ। कोई वास्तविक संदेश या फोटो नहीं भेजी गई।" : "Demo complete. No real message or photo was sent.")
                            : (isHindi ? "ट्यूटोरियल पूरा हुआ। आपके फोन की वास्तविक सेटिंग नहीं बदली।" : "Tutorial complete. Your actual phone settings were not changed.");
        screen.innerHTML = `<div class="workflow-complete"><div class="raasta-avatar">🎉</div><h3>${isHindi ? "बहुत बढ़िया!" : "Nicely done!"}</h3><p>${message}</p><button id="workflowAgain" class="workflow-action" type="button">↻ ${isHindi ? "फिर से शुरू करें" : "Start again"}</button></div>`;
        guide.querySelector("#workflowAgain").onclick = restartWorkflow;
        instruction.textContent = isHindi ? "सभी सिम्युलेटेड चरण पूरे हुए।" : "All simulated steps are complete.";
        stepTitle.textContent = isHindi ? "ट्यूटोरियल पूरा" : "Tutorial complete";
        stepCount.textContent = isHindi ? "पूरा हुआ" : "Complete";
        progress.style.width = "100%";
        guide.querySelector(".progress-bar").setAttribute("aria-valuenow", "100");
        previous.disabled = true;
        next.disabled = true;
    }

    function advanceStep() {
        stopSpeech();
        captureInputs();
        const target = plan.steps[currentStep].targetElementId;
        if (target === "documentCategory" && !state.documentType) {
            feedback.textContent = isHindi ? "कृपया दस्तावेज़ की श्रेणी चुनें।" : "Please choose a document category.";
            return;
        }
        const needs = (ok, english, hindi) => {
            if (ok) return false;
            feedback.textContent = isHindi ? hindi : english;
            return true;
        };
        if (target === "upiEnterId" && needs(/^[\w.\-]{2,}@[A-Za-z][\w]{1,}$/.test(state.upiId), "Enter a UPI ID in the form name@bank.", "UPI ID को name@bank के रूप में लिखें।")) return;
        if (target === "upiEnterAmount" && needs(Number(state.upiAmount) > 0, "Enter an amount greater than zero.", "शून्य से ज़्यादा रकम दर्ज करें।")) return;
        if (target === "emailTo" && needs(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.emailTo), "Enter a valid email address such as name@example.com.", "name@example.com जैसा सही ईमेल पता दर्ज करें।")) return;
        if (target === "emailSubject" && needs(state.emailSubject.length > 0, "Add a short subject so the receiver knows what the email is about.", "छोटा Subject जोड़ें ताकि पाने वाला समझ सके कि ईमेल किस बारे में है।")) return;
        if (target === "emailAttach") state.emailAttached = true;
        if (target === "trainSearch") state.searched = true;
        if (target === "trainSelect") state.selectedTrain ||= "Intercity Express";
        if (target === "phoneConnect") state.wifiConnected = true;
        if (target === "phoneToggle") state.bluetooth = !state.bluetooth;
        if (["bookingConfirm", "documentDownload", "phoneConnected", "phoneBrightnessDone", "phoneBluetoothDone", "upiSuccess", "emailSent", "chatSent"].includes(target)) {
            finishWorkflow();
            return;
        }
        if (currentStep < plan.steps.length - 1) currentStep += 1;
        renderStage();
    }

    function restartWorkflow() {
        stopSpeech();
        resetState();
        currentStep = 0;
        if (activeGuidance) activeGuidance.completed = false;
        previous.disabled = false;
        next.disabled = false;
        renderStage();
    }

    function previousStep() {
        if (currentStep === 0) return;
        stopSpeech();
        captureInputs();
        currentStep -= 1;
        renderStage();
    }

    previous.onclick = previousStep;
    next.onclick = advanceStep;
    guide.querySelector("#workflowSpeak").onclick = () => speakText(activeGuidance.getCurrent().instruction, guide.querySelector("#workflowSpeak"));
    guide.querySelector("#workflowRestart").onclick = restartWorkflow;
    guide.querySelector("#workflowHelp").onclick = () => {
        const target = plan.steps[currentStep].targetElementId;
        feedback.textContent = isHindi
            ? `“${workflowStepTitle(target)}” के लिए पीले रंग में हाइलाइट किए गए कंट्रोल को सिम्युलेटर में देखें। न मिले तो अगला चुनें या गाइड फिर शुरू करें।`
            : `Look for the yellow highlighted control for “${workflowStepTitle(target)}” in the simulation. If it is still hard to find, choose Next or restart the guide.`;
    };
    registerActiveGuidance({
        category: plan.category,
        task,
        completed: false,
        getCurrent: () => {
            const step = plan.steps[currentStep];
            const target = step.targetElementId;
            const title = workflowStepTitle(target);
            return { index: currentStep, target, title, rawInstruction: step.instruction, instruction: formatGuidanceInstruction(step.instruction, target, title, isHindi) };
        },
        setFeedback: message => { feedback.textContent = message; },
        previous: previousStep,
        next: advanceStep,
        restart: restartWorkflow,
        refresh: () => { if (!activeGuidance?.completed) { captureInputs(); stopSpeech(); renderStage(); } }
    });
    renderStage();
    guide.scrollIntoView({ behavior: "smooth", block: "start" });
}


// Display Guided Experience

function showUniversalGuide(task, plan, startingStep = 0) {
    clearActiveGuidance();
    const isHindi = plan.language === "hi";
    const steps = plan.steps.map(step => ({ title: step.title, instruction: step.instruction }));
    let currentStep = Math.max(0, Math.min(startingStep, steps.length - 1));
    let completed = false;
    let guide = document.getElementById("guidePanel");

    if (!guide) {
        guide = document.createElement("section");
        guide.id = "guidePanel";
        guide.className = "guide-panel";
        document.querySelector(".hero").after(guide);
    }
    guide.style.display = "block";
    guide.innerHTML = `
        <div class="universal-guide">
            <header class="universal-header">
                <p class="tagline">${isHindi ? "RAASTA · सामान्य डिजिटल मार्गदर्शन" : "RAASTA · UNIVERSAL GUIDANCE"}</p>
                <h2>${isHindi ? "आपके काम के लिए चरण-दर-चरण मदद" : "Guidance for your task"}</h2>
                <p class="guide-task"></p>
                <p class="universal-disclosure">${isHindi ? "सामान्य मार्गदर्शन · Raasta आपके उपकरण को नियंत्रित नहीं करता। मेन्यू और बटन मॉडल के अनुसार बदल सकते हैं।" : "GENERAL GUIDANCE · Raasta does not control your device. Menus and buttons can vary by model."}</p>
            </header>
            <div class="universal-layout">
                <section class="universal-context" aria-label="${isHindi ? "उपकरण का संदर्भ" : "Device context"}">
                    <span class="universal-context-label">${isHindi ? "आपका उपकरण" : "YOUR DEVICE"}</span>
                    <strong class="universal-device"></strong>
                    <p>${isHindi ? "इस गाइड में वास्तविक स्क्रीन का दृश्य या कंट्रोल हाइलाइट नहीं है।" : "This guide does not view your screen or highlight real controls."}</p>
                    <ol class="universal-step-list" aria-label="${isHindi ? "सभी चरण" : "All steps"}"></ol>
                </section>
                <aside class="universal-instructions">
                    <p class="tagline">${isHindi ? "रास्ता कहता है" : "RAASTA SAYS"}</p>
                    <div class="progress-bar" role="progressbar" aria-label="${isHindi ? "गाइड की प्रगति" : "Guide progress"}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill"></div></div>
                    <p class="step-count"></p>
                    <h3 class="universal-step-title" aria-live="polite"></h3>
                    <p class="universal-step-instruction" aria-live="polite"></p>
                    <button class="voice-btn repeat-instruction" type="button" aria-label="${isHindi ? "वर्तमान निर्देश फिर से सुनें" : "Repeat current instruction"}">${isHindi ? "🔊 निर्देश फिर सुनें" : "🔊 Repeat instruction"}</button>
                    <div class="visual-navigation"><button class="voice-btn universal-previous" type="button">← ${isHindi ? "पिछला" : "Previous"}</button><button class="start-btn universal-next" type="button">${isHindi ? "अगला →" : "Next →"}</button></div>
                    <button class="voice-btn universal-restart" type="button">↻ ${isHindi ? "फिर से शुरू करें" : "Restart"}</button>
                    <button class="voice-btn universal-help" type="button">? ${isHindi ? "समझ नहीं आया / अटक गया" : "I'm stuck / explain this"}</button>
                    <p class="workflow-feedback" aria-live="polite"></p>
                </aside>
            </div>
        </div>`;

    guide.querySelector(".guide-task").textContent = `${isHindi ? "आपका काम: " : "Your task: "}${task}`;
    guide.querySelector(".universal-device").textContent = [plan.device, plan.platform].filter(Boolean).join(" · ") || (isHindi ? "बताया गया डिजिटल उपकरण" : "Digital device from your request");
    const progress = guide.querySelector(".progress-fill");
    const stepCount = guide.querySelector(".step-count");
    const title = guide.querySelector(".universal-step-title");
    const instruction = guide.querySelector(".universal-step-instruction");
    const feedback = guide.querySelector(".workflow-feedback");
    const previous = guide.querySelector(".universal-previous");
    const next = guide.querySelector(".universal-next");
    const list = guide.querySelector(".universal-step-list");
    list.innerHTML = steps.map((step, index) => `<li data-step="${index}"></li>`).join("");
    steps.forEach((step, index) => { list.children?.[index] && (list.children[index].textContent = step.title); });

    function updateStep() {
        stopSpeech();
        const step = steps[currentStep];
        title.textContent = step.title;
        instruction.textContent = formatGuidanceInstruction(step.instruction, null, step.title, isHindi);
        stepCount.textContent = isHindi ? `चरण ${currentStep + 1} / ${steps.length}` : `Step ${currentStep + 1} of ${steps.length}`;
        progress.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
        guide.querySelector(".progress-bar").setAttribute("aria-valuenow", String(Math.round(((currentStep + 1) / steps.length) * 100)));
        previous.disabled = currentStep === 0;
        next.disabled = completed;
        next.textContent = completed ? (isHindi ? "पूरा हुआ ✓" : "Guidance complete ✓") : currentStep === steps.length - 1 ? (isHindi ? "समाप्त ✓" : "Finish ✓") : (isHindi ? "अगला →" : "Next →");
        list.querySelectorAll("li").forEach((item, index) => {
            item.classList.toggle("is-current", index === currentStep);
            item.classList.toggle("is-complete", index < currentStep || completed);
            if (index === currentStep) item.setAttribute("aria-current", "step");
            else item.removeAttribute("aria-current");
        });
        feedback.textContent = completed
            ? (isHindi ? "मार्गदर्शन पूरा हुआ। कोई सेटिंग नहीं बदली; चरण अपने उपकरण पर स्वयं करें।" : "Guidance complete. No settings were changed; carry out the steps on your own device.")
            : "";
    }

    function previousStep() { if (currentStep > 0 && !completed) { currentStep -= 1; updateStep(); } }
    function nextStep() {
        if (completed) return;
        if (currentStep < steps.length - 1) currentStep += 1;
        else {
            completed = true;
            if (activeGuidance) activeGuidance.completed = true;
        }
        updateStep();
    }
    function restart() { stopSpeech(); completed = false; currentStep = 0; if (activeGuidance) activeGuidance.completed = false; updateStep(); }
    previous.onclick = previousStep;
    next.onclick = nextStep;
    guide.querySelector(".repeat-instruction").onclick = () => speakText(steps[currentStep].instruction, guide.querySelector(".repeat-instruction"));
    guide.querySelector(".universal-restart").onclick = restart;
    guide.querySelector(".universal-help").onclick = () => {
        const message = isHindi
            ? `यह सामान्य उपकरण मार्गदर्शन है; स्क्रीन से नियंत्रण नहीं है। अभी “${steps[currentStep].title}” करें: ${steps[currentStep].instruction}`
            : `This is general device guidance; Raasta is not connected to the screen. For “${steps[currentStep].title}”: ${steps[currentStep].instruction}`;
        feedback.textContent = message;
        speakText(message);
    };

    registerActiveGuidance({
        category: "universal_guidance", task, device: plan.device, completed: false,
        getCurrent: () => ({ index: currentStep, target: null, title: steps[currentStep].title, rawInstruction: steps[currentStep].instruction, instruction: formatGuidanceInstruction(steps[currentStep].instruction, null, steps[currentStep].title, isHindi) }),
        setFeedback: message => { feedback.textContent = message; },
        previous: previousStep,
        next: nextStep,
        restart,
        refresh: () => { if (!activeGuidance?.completed) updateStep(); }
    });
    updateStep();
    guide.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showGuide(task, plan = null, startingStep = 0) {

    if (plan?.category === "universal_guidance" && plan.supported) {
        showUniversalGuide(task, plan, startingStep);
        return;
    }

    if (plan && ["train_booking", "document_download", "smartphone_basics", "upi_payment", "email_attachment", "chat_message"].includes(plan.category)) {
        showWorkflowGuide(task, plan, startingStep);
        return;
    }
    clearActiveGuidance();

    const isHindi = language.value === "hi";
    const guideLanguage = plan?.language || language.value;
    const text = task.toLowerCase();
    const isDocumentTask = plan
        ? plan.category === "fee_receipt" && plan.supported === true
        : ["document", "download", "receipt", "fee", "दस्तावेज़", "डाउनलोड", "रसीद", "फीस"].some(keyword => text.includes(keyword));
    let guide = document.getElementById("guidePanel");

    if (!guide) {
        guide = document.createElement("section");
        guide.id = "guidePanel";
        guide.className = "guide-panel";
        document.querySelector(".hero").after(guide);
    }

    guide.style.display = "block";

    if (!isDocumentTask) {
        let instructions = getInstructions(task);
        if (isHindi) instructions = translateToHindi(instructions);
        let currentStep = Math.min(resumeGuideAtStep, instructions.length - 1);
        resumeGuideAtStep = 0;

        guide.innerHTML = `
            <div class="guide-content">
                <p class="tagline">${isHindi ? "रास्ता गाइड" : "RAASTA GUIDE"}</p>
                <h2>${isHindi ? "आइए शुरू करते हैं!" : "Let's get started!"}</h2>
                <p class="guide-task"></p>
                <div class="progress-bar"><div class="progress-fill"></div></div>
                <p class="step-count"></p>
                <div class="instruction-box">
                    <div class="step-number"></div>
                    <h3 class="instruction-text"></h3>
                </div>
                <div class="guide-buttons">
                    <button id="previousBtn" class="voice-btn">← ${isHindi ? "पिछला" : "Previous"}</button>
                    <button id="speakBtn" class="voice-btn">🔊 ${isHindi ? "सुनें" : "Read aloud"}</button>
                    <button id="nextBtn" class="start-btn">${isHindi ? "अगला →" : "Next →"}</button>
                </div>
            </div>`;

        guide.querySelector(".guide-task").textContent = (isHindi ? "आपका काम: " : "Your task: ") + task;
        const update = () => {
            guide.querySelector(".instruction-text").textContent = instructions[currentStep];
            guide.querySelector(".step-number").textContent = currentStep + 1;
            guide.querySelector(".step-count").textContent = isHindi
                ? `चरण ${currentStep + 1} / ${instructions.length}`
                : `Step ${currentStep + 1} of ${instructions.length}`;
            guide.querySelector(".progress-fill").style.width = ((currentStep + 1) / instructions.length * 100) + "%";
            guide.querySelector("#previousBtn").disabled = currentStep === 0;
            guide.querySelector("#nextBtn").textContent = currentStep === instructions.length - 1
                ? (isHindi ? "समाप्त ✓" : "Finish ✓")
                : (isHindi ? "अगला →" : "Next →");
            guide.querySelector("#previousBtn").textContent = isHindi ? "← पिछला" : "← Previous";
        };
        guide.querySelector("#previousBtn").onclick = () => { if (currentStep > 0) { currentStep--; update(); } };
        guide.querySelector("#nextBtn").onclick = () => {
            if (currentStep < instructions.length - 1) { currentStep++; update(); }
            else alert(isHindi ? "बहुत बढ़िया! आपने सभी चरण पूरे कर लिए।" : "Well done! You completed the guidance.");
        };
        guide.querySelector("#speakBtn").onclick = () => speakText(instructions[currentStep], guide.querySelector("#speakBtn"));
        update();
        guide.scrollIntoView({ behavior: "smooth" });
        return;
    }

    const defaultSteps = [
        { en: "Click Documents in the sidebar.", hi: "साइडबार में Documents पर क्लिक करें।", target: "portalDocuments" },
        { en: "Now select Fee Receipts.", hi: "अब Fee Receipts चुनें।", target: "portalReceipts" },
        { en: "Click Download Receipt to finish this demo.", hi: "इस डेमो को पूरा करने के लिए Download Receipt पर क्लिक करें।", target: "portalDownload" }
    ];
    const steps = plan?.steps?.map(step => ({
        instruction: step.instruction,
        target: step.targetElementId
    })) || defaultSteps.map(step => ({
        instruction: isHindi ? step.hi : step.en,
        target: step.target
    }));
    let currentStep = Math.min(startingStep, steps.length - 1);

    guide.innerHTML = `
        <div class="visual-guide">
            <div class="visual-heading">
                <p class="tagline">${isHindi ? "रास्ता इंटरैक्टिव गाइड" : "RAASTA INTERACTIVE GUIDE"}</p>
                <h2>${isHindi ? "आपका डिजिटल गाइड" : "Your digital guide"}</h2>
                <p class="guide-task"></p>
                <p id="guideSummary" class="guide-summary"></p>
                <p class="simulation-note">${isHindi ? "यह केवल एक सिमुलेशन है। कोई वास्तविक पोर्टल या फ़ाइल उपयोग नहीं होती।" : "SIMULATION ONLY · No real portal or file is used."}</p>
            </div>
            <div class="guide-layout">
                <div class="portal">
                    <div class="portal-header"><strong>🎓 ${isHindi ? "छात्र पोर्टल" : "Student Portal"}</strong><span>${isHindi ? "डेमो छात्र खाता · नामांकन DEMO-2025-0042 · सेमेस्टर 1" : "Demo Student Account · Enrolment DEMO-2025-0042 · Semester 1"}</span></div>
                    <div class="portal-body">
                        <aside class="portal-sidebar">
                            <p>${isHindi ? "मुख्य मेन्यू" : "MAIN MENU"}</p>
                            <button class="portal-option nav-current" id="portalNavDashboard" type="button">🏠 ${isHindi ? "डैशबोर्ड" : "Dashboard"}</button>
                            <button class="portal-option" type="button">👤 ${isHindi ? "मेरी प्रोफ़ाइल" : "My Profile"}</button>
                            <button class="portal-option" id="portalDocuments" type="button">📁 ${isHindi ? "दस्तावेज़" : "Documents"}</button>
                            <button class="portal-option" type="button">💳 ${isHindi ? "फीस विवरण" : "Fee Details"}</button>
                            <button class="portal-option" type="button">📝 ${isHindi ? "परीक्षा" : "Examinations"}</button>
                            <button class="portal-option" type="button">📚 ${isHindi ? "पुस्तकालय" : "Library"}</button>
                        </aside>
                        <div class="portal-main">
                            <div id="portalDashboardPage">
                                <h3>${isHindi ? "वापसी पर स्वागत है, Demo Student" : "Welcome back, Demo Student"}</h3><p>${isHindi ? "सेमेस्टर 1 · शैक्षणिक वर्ष 2025–26" : "Semester 1 · Academic year 2025–26"}</p>
                                <div class="stat-row"><div class="stat"><strong>86%</strong><span>${isHindi ? "उपस्थिति (डेमो)" : "Attendance (demo)"}</span></div><div class="stat"><strong>₹0</strong><span>${isHindi ? "बकाया फीस (डेमो)" : "Fees due (demo)"}</span></div><div class="stat"><strong>2</strong><span>${isHindi ? "नई सूचनाएँ" : "New notices"}</span></div></div>
                                <div class="document-card"><div class="document-icon">📢</div><div><strong>${isHindi ? "सूचना" : "Notice"}</strong><p>${isHindi ? "मध्य-सेमेस्टर परीक्षा का कार्यक्रम जल्द प्रकाशित होगा। (नमूना)" : "Mid-semester exam schedule will be published soon. (sample)"}</p></div></div>
                            </div>
                            <div id="portalDocsPage" hidden>
                            <h3>${isHindi ? "मेरे दस्तावेज़" : "My Documents"}</h3><p>${isHindi ? "अपने कॉलेज के दस्तावेज़ यहाँ देखें।" : "Manage your college documents here."}</p>
                            <div class="document-card"><div class="document-icon">📄</div><div><strong>${isHindi ? "फीस रसीदें" : "Fee Receipts"}</strong><p>${isHindi ? "भुगतान की रसीदें देखें" : "View your payment receipts"}</p></div><button id="portalReceipts" class="portal-action" type="button">${isHindi ? "खोलें →" : "Open →"}</button></div>
                            <div class="document-card"><div class="document-icon">📋</div><div><strong>${isHindi ? "शैक्षणिक दस्तावेज़" : "Academic Documents"}</strong><p>${isHindi ? "अपने शैक्षणिक रिकॉर्ड देखें" : "View your academic records"}</p></div><button class="portal-action" type="button" disabled>${isHindi ? "खोलें →" : "Open →"}</button></div>
                            <div class="receipt-box" id="receiptBox"><h3>${isHindi ? "फीस रसीद - सेमेस्टर 1" : "Fee Receipt - Semester 1"}</h3><p>${isHindi ? "छात्र: डेमो छात्र" : "Student: Demo Student"}</p><p>${isHindi ? "स्थिति: डेमो भुगतान रिकॉर्ड" : "Status: Demo payment record"}</p><dl class="workflow-summary"><dt>${isHindi ? "रसीद संख्या" : "Receipt no."}</dt><dd>DEMO-FR-0001</dd><dt>${isHindi ? "भुगतान की तारीख" : "Payment date"}</dt><dd>12 Aug 2025</dd><dt>${isHindi ? "शैक्षणिक वर्ष" : "Academic year"}</dt><dd>2025–26</dd><dt>${isHindi ? "रकम (डेमो)" : "Amount (demo)"}</dt><dd>₹ 45,000</dd><dt>${isHindi ? "भुगतान का तरीका" : "Payment mode"}</dt><dd>${isHindi ? "ऑनलाइन (डेमो)" : "Online (demo)"}</dd><dt>${isHindi ? "स्थिति" : "Status"}</dt><dd>${isHindi ? "भुगतान हुआ" : "Paid"}</dd></dl><button id="portalDownload" class="download-action" type="button">⬇ ${isHindi ? "रसीद डाउनलोड करें" : "Download Receipt"}</button></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="instruction-panel">
                    <div class="raasta-avatar">🧭</div><p class="tagline">${isHindi ? "रास्ता कहता है" : "RAASTA SAYS"}</p>
                    <div class="progress-bar" role="progressbar" aria-label="${isHindi ? "प्रगति" : "Guide progress"}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill"></div></div><p class="step-count"></p>
                    <h3 class="current-step-title" aria-live="polite"></h3><p id="visualInstruction" aria-live="polite"></p>
                    <p class="guidance-detail" aria-live="polite"></p>
                    <button id="visualSpeak" class="voice-btn repeat-instruction" type="button" aria-label="${isHindi ? "वर्तमान निर्देश फिर से सुनें" : "Repeat current instruction"}">🔊 ${isHindi ? "निर्देश फिर सुनें" : "Repeat instruction"}</button>
                    <div class="visual-navigation"><button id="visualPrevious" class="voice-btn" type="button">← ${isHindi ? "पिछला" : "Previous"}</button><button id="visualNext" class="start-btn" type="button">${isHindi ? "अगला →" : "Next →"}</button></div>
                    <button id="visualHelp" class="voice-btn" type="button">? ${isHindi ? "कंट्रोल नहीं मिल रहा?" : "Can't find the control?"}</button>
                    <p class="help-hint">${isHindi ? "सही हाइलाइट किए गए बटन पर क्लिक करके भी आगे बढ़ें।" : "Click the highlighted portal button or use Next."}</p>
                    <p id="portalFeedback" aria-live="polite"></p>
                </div>
            </div>
        </div>`;

    guide.querySelector(".guide-task").textContent = (isHindi ? "आपका काम: " : "Your task: ") + (plan?.task || task);
    guide.querySelector("#guideSummary").textContent = plan?.instruction || "";
    const instruction = guide.querySelector("#visualInstruction");
    const progress = guide.querySelector(".progress-fill");
    const stepCount = guide.querySelector(".step-count");
    const previous = guide.querySelector("#visualPrevious");
    const next = guide.querySelector("#visualNext");
    const feedback = guide.querySelector("#portalFeedback");
    const currentStepTitle = guide.querySelector(".current-step-title");
    const currentStepDetail = guide.querySelector(".guidance-detail");
    const targetIds = steps.map(step => step.target);

    function updateStep() {
        stopSpeech();
        const titles = isHindi ? ["दस्तावेज़ खोलें", "फीस रसीदें चुनें", "डेमो पूरा करें"] : ["Open Documents", "Choose Fee Receipts", "Finish the demo"];
        const currentTitle = titles[targetIds.indexOf(steps[currentStep].target)] || (isHindi ? "वर्तमान चरण" : "Current step");
        instruction.textContent = steps[currentStep].instruction;
        currentStepDetail.textContent = guidanceDetail(steps[currentStep].target, currentTitle, isHindi);
        currentStepTitle.textContent = currentTitle;
        stepCount.textContent = isHindi ? `चरण ${currentStep + 1} / ${steps.length}` : `Step ${currentStep + 1} of ${steps.length}`;
        progress.style.width = ((currentStep + 1) / steps.length * 100) + "%";
        guide.querySelector(".progress-bar").setAttribute("aria-valuenow", String(Math.round((currentStep + 1) / steps.length * 100)));
        previous.disabled = currentStep === 0;
        next.textContent = currentStep === steps.length - 1 ? (isHindi ? "समाप्त ✓" : "Finish ✓") : (isHindi ? "अगला →" : "Next →");
        targetIds.forEach(id => guide.querySelector(`#${id}`).classList.remove("active-target"));
        guide.querySelector(`#${steps[currentStep].target}`).classList.add("active-target");
        const onDashboard = steps[currentStep].target === "portalDocuments";
        const dashboardPage = guide.querySelector("#portalDashboardPage");
        const docsPage = guide.querySelector("#portalDocsPage");
        if (dashboardPage) dashboardPage.hidden = !onDashboard;
        if (docsPage) docsPage.hidden = onDashboard;
        const dashboardNav = guide.querySelector("#portalNavDashboard");
        const documentsNav = guide.querySelector("#portalDocuments");
        if (dashboardNav) { if (onDashboard) dashboardNav.classList.add("nav-current"); else dashboardNav.classList.remove("nav-current"); }
        if (documentsNav) { if (onDashboard) documentsNav.classList.remove("nav-current"); else documentsNav.classList.add("nav-current"); }
        if (steps[currentStep].target === "portalDownload") {
            guide.querySelector("#receiptBox").classList.add("receipt-visible");
        }
        feedback.textContent = "";
    }

    function completeDemo() {
        stopSpeech();
        if (activeGuidance) activeGuidance.completed = true;
        guide.querySelector(".instruction-panel").innerHTML = `
            <div class="raasta-avatar">🎉</div><h2>${isHindi ? "बहुत बढ़िया!" : "Demo complete!"}</h2>
            <p>${isHindi ? "आपने सिम्युलेटेड चरण पूरे किए। कोई वास्तविक फ़ाइल डाउनलोड नहीं हुई।" : "You completed the simulated steps. No real file was downloaded."}</p>
            <button id="restartVisual" class="start-btn" type="button">${isHindi ? "फिर से शुरू करें" : "Start again"}</button>`;
        targetIds.forEach(id => guide.querySelector(`#${id}`).classList.remove("active-target"));
        guide.querySelector("#restartVisual").onclick = () => {
            stopSpeech();
            if (language.value !== guideLanguage) {
                language.value = guideLanguage;
                applyPageLanguage();
            }
            showGuide(task, plan, 0);
        };
    }

    function advanceStep() {
        if (currentStep < steps.length - 1) { currentStep++; updateStep(); }
        else completeDemo();
    }

    function previousStep() { if (currentStep > 0) { currentStep--; updateStep(); } }
    previous.onclick = previousStep;
    next.onclick = advanceStep;
    guide.querySelector("#visualSpeak").onclick = () => speakText(activeGuidance?.getCurrent().instruction || steps[currentStep].instruction, guide.querySelector("#visualSpeak"));
    guide.querySelector("#visualHelp").onclick = () => {
        const targetLabel = steps[currentStep].target === "portalDocuments"
            ? (isHindi ? "दस्तावेज़" : "Documents")
            : steps[currentStep].target === "portalReceipts"
                ? (isHindi ? "फीस रसीदें" : "Fee Receipts")
                : (isHindi ? "रसीद डाउनलोड करें" : "Download Receipt");
        feedback.textContent = isHindi
            ? `पीले रंग में हाइलाइट किया गया “${targetLabel}” बटन देखें। फिर भी न मिले तो अगला चुनें या गाइड फिर शुरू करें।`
            : `Look for the yellow highlighted “${targetLabel}” button. If you still cannot find it, use Next or restart the guide.`;
    };

    targetIds.forEach((id, index) => {
        guide.querySelector(`#${id}`).onclick = () => {
            if (index !== currentStep) {
                feedback.textContent = isHindi ? "कोई बात नहीं! पहले हाइलाइट किए गए बटन पर क्लिक करें।" : "No worries! Click the highlighted button first.";
                speakText(isHindi ? "पहले हाइलाइट किए गए बटन पर क्लिक करें।" : "Please click the highlighted button first.");
                return;
            }
            if (id === "portalReceipts") guide.querySelector("#receiptBox").classList.add("receipt-visible");
            if (id === "portalDownload") feedback.textContent = isHindi ? "यह डेमो है; कोई फ़ाइल डाउनलोड नहीं हुई।" : "This is a demo; no file was downloaded.";
            advanceStep();
        };
    });

    function currentFeeTitle(target) {
        const titles = isHindi ? { portalDocuments: "दस्तावेज़ खोलें", portalReceipts: "फीस रसीदें चुनें", portalDownload: "डेमो पूरा करें" }
            : { portalDocuments: "Open Documents", portalReceipts: "Choose Fee Receipts", portalDownload: "Finish the demo" };
        return titles[target] || (isHindi ? "वर्तमान चरण" : "Current step");
    }
    registerActiveGuidance({
        category: "fee_receipt",
        task: plan?.task || task,
        completed: false,
        getCurrent: () => {
            const step = steps[currentStep];
            const title = currentFeeTitle(step.target);
            return { index: currentStep, target: step.target, title, rawInstruction: step.instruction, instruction: formatGuidanceInstruction(step.instruction, step.target, title, isHindi) };
        },
        setFeedback: message => { feedback.textContent = message; },
        previous: previousStep,
        next: advanceStep,
        restart: () => showGuide(task, plan, 0),
        refresh: () => { if (!activeGuidance?.completed) { stopSpeech(); updateStep(); } }
    });

    updateStep();
    guide.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Start Button

startBtn.addEventListener("click", function () {

    const task = taskInput.value.trim();

    if (task === "") {
        setTaskStatus(language.value === "hi"
            ? "कृपया बताइए कि आपको किस काम में मदद चाहिए।"
            : "Please tell us what you want help with.", "error");
        taskInput.focus();
        return;
    }

    if (activeGuidance) {
        handleGuideFollowUp(task);
        return;
    }

    setTaskStatus("");
    requestTaskGuide(task);

});



function checkHindiVoices() {

    const voices = window.speechSynthesis.getVoices();

    console.log("Available voices:");

    voices.forEach(voice => {
        console.log(voice.name, voice.lang);
    });

    const hindiVoices = voices.filter(voice =>
        voice.lang.toLowerCase().startsWith("hi")
    );

    console.log("Hindi voices found:", hindiVoices);
}

window.speechSynthesis.onvoiceschanged = checkHindiVoices;

checkHindiVoices();
