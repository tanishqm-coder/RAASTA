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

function speakWithBrowser(text) {
    const synth = window.speechSynthesis;

    if (!synth) {
        setTaskStatus(language.value === "hi"
            ? "इस ब्राउज़र में आवाज़ चलाना उपलब्ध नहीं है।"
            : "Speech output is not supported in this browser.", "error");
        return;
    }

    synth.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.rate = speechSpeed;
    speech.pitch = 1;
    speech.volume = 1;

    const voices = synth.getVoices();

    if (language.value === "hi") {

        const hindiVoice = voices.find(v =>
            v.lang.toLowerCase() === "hi-in"
        );

        if (!hindiVoice) {
            setTaskStatus("Sarvam is unavailable and this browser has no Hindi voice installed.", "error");
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
        phoneToggle: "यह बदलाव केवल सिम्युलेटेड फोन स्क्रीन पर होगा।"
    } : {
        trainSource: "The starting city is where the journey begins.",
        trainDestination: "The destination is the city you are travelling to.",
        documentCategory: "A category means the kind of document you need.",
        portalReceipts: "This area contains sample college fee receipts.",
        phoneConnect: "This is only a sample network in the practice screen.",
        phoneToggle: "This changes only the simulated phone screen."
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
        ? { fee_receipt: "फीस रसीद", train_booking: "ट्रेन बुकिंग", document_download: "दस्तावेज़ डाउनलोड", smartphone_basics: "फोन ट्यूटोरियल" }
        : { fee_receipt: "fee receipt", train_booking: "train booking", document_download: "document download", smartphone_basics: "phone tutorial" };
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
            bluetooth: false
        };
    };
    resetState();

    function workflowStepTitle(target) {
        const titles = isHindi ? {
            trainSource: "शुरुआती शहर", trainDestination: "गंतव्य शहर", trainDate: "यात्रा की तारीख", trainSearch: "नमूना ट्रेनें खोजें", trainSelect: "ट्रेन चुनें", trainPassenger: "यात्री का विवरण", trainReview: "यात्रा की समीक्षा", bookingConfirm: "डेमो बुकिंग पूरी करें",
            documentOpen: "Documents खोलें", documentCategory: "दस्तावेज़ की श्रेणी चुनें", documentSample: "नमूना दस्तावेज़ चुनें", documentPreview: "पूर्वावलोकन देखें", documentDownload: "डेमो पूरा करें",
            phoneTutorialChoice: "ट्यूटोरियल चुनें", phoneSettings: "Settings खोलें", phoneWifi: "Wi-Fi सेटिंग चुनें", phoneNetwork: "नेटवर्क चुनें", phoneConnect: "कनेक्ट करें", phoneConnected: "कनेक्शन देखें", phoneDisplay: "Display सेटिंग चुनें", phoneBrightness: "चमक बदलें", phoneBrightnessDone: "चमक की पुष्टि करें", phoneBluetooth: "Bluetooth सेटिंग चुनें", phoneToggle: "Bluetooth बदलें", phoneBluetoothDone: "स्थिति देखें"
        } : {
            trainSource: "Enter your starting city", trainDestination: "Enter your destination", trainDate: "Choose a travel date", trainSearch: "Search sample trains", trainSelect: "Choose a train", trainPassenger: "Enter passenger details", trainReview: "Review the journey", bookingConfirm: "Complete the demo booking",
            documentOpen: "Open Documents", documentCategory: "Choose a document category", documentSample: "Choose a sample document", documentPreview: "Review the preview", documentDownload: "Finish the demo",
            phoneTutorialChoice: "Choose a tutorial", phoneSettings: "Open Settings", phoneWifi: "Choose Wi-Fi settings", phoneNetwork: "Choose a network", phoneConnect: "Connect to the sample network", phoneConnected: "Check the connection", phoneDisplay: "Open Display settings", phoneBrightness: "Adjust screen brightness", phoneBrightnessDone: "Check the brightness", phoneBluetooth: "Open Bluetooth settings", phoneToggle: "Turn Bluetooth on or off", phoneBluetoothDone: "Check Bluetooth status"
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
                <p class="simulation-note">${isHindi ? "यह केवल एक सिमुलेशन है। कोई वास्तविक टिकट बुक, दस्तावेज़ डाउनलोड या डिवाइस सेटिंग नहीं बदली जाएगी।" : "SIMULATION ONLY · No real ticket is booked, document downloaded, or device setting changed."}</p>
            </header>
            <div class="workflow-layout">
                <section class="workflow-simulator" aria-label="${isHindi ? "सिम्युलेटेड अभ्यास" : "Simulated practice"}">
                    <div class="workflow-device-header"><span>${plan.category === "train_booking" ? "🚆" : plan.category === "document_download" ? "📁" : "📱"}</span><strong class="workflow-app-title"></strong><span class="demo-badge">${isHindi ? "डेमो" : "DEMO"}</span></div>
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

    function renderTrainStage(target) {
        guide.querySelector(".workflow-app-title").textContent = isHindi ? "रेल यात्रा डेमो" : "Train Journey Demo";
        if (target === "trainSource") return `<h3>${isHindi ? "कहाँ से यात्रा शुरू करेंगे?" : "Where will you start?"}</h3><label>${isHindi ? "शुरुआती शहर" : "From city"}<input id="trainSource" type="text" autocomplete="off" aria-label="${isHindi ? "शुरुआती शहर" : "Starting city"}"></label>`;
        if (target === "trainDestination") return `<h3>${isHindi ? "आपका गंतव्य क्या है?" : "Where are you going?"}</h3><label>${isHindi ? "गंतव्य शहर" : "To city"}<input id="trainDestination" type="text" autocomplete="off" aria-label="${isHindi ? "गंतव्य शहर" : "Destination city"}"></label>`;
        if (target === "trainDate") return `<h3>${isHindi ? "यात्रा की तारीख चुनें" : "Choose your travel date"}</h3><label>${isHindi ? "यात्रा की तारीख" : "Travel date"}<input id="trainDate" type="date" aria-label="${isHindi ? "यात्रा की तारीख" : "Travel date"}"></label>`;
        if (target === "trainSearch") return `<h3>${isHindi ? "नमूना ट्रेनें खोजें" : "Search sample trains"}</h3><p class="workflow-muted">${escapeWorkflowText(state.source)} → ${escapeWorkflowText(state.destination)}</p><button id="trainSearch" class="workflow-action" type="button">🔎 ${isHindi ? "ट्रेनें खोजें" : "Search trains"}</button>`;
        if (target === "trainSelect") return `<h3>${isHindi ? "एक डेमो ट्रेन चुनें" : "Choose a sample train"}</h3><button id="trainSelect" class="workflow-choice active-choice" type="button"><strong>🚆 Intercity Express</strong><span>08:30 → 14:15 · ${escapeWorkflowText(state.source)} to ${escapeWorkflowText(state.destination)}</span></button><button class="workflow-choice" type="button" data-train="Superfast Express"><strong>🚄 Superfast Express</strong><span>10:10 → 15:40 · ${isHindi ? "नमूना विकल्प" : "Sample option"}</span></button>`;
        if (target === "trainPassenger") return `<h3>${isHindi ? "यात्री का डेमो विवरण" : "Demo passenger details"}</h3><p class="workflow-muted">${isHindi ? "यह जानकारी केवल इस ब्राउज़र के डेमो में रहती है।" : "These details stay in this browser simulation only."}</p><label>${isHindi ? "नाम" : "Name"}<input id="passengerName" type="text" autocomplete="off"></label><label>${isHindi ? "उम्र" : "Age"}<input id="passengerAge" type="number" min="1" max="120"></label><button id="trainPassenger" class="workflow-action" type="button">${isHindi ? "विवरण सहेजें" : "Save demo details"}</button>`;
        if (target === "trainReview") return `<h3>${isHindi ? "बुकिंग की समीक्षा" : "Review booking"}</h3><dl class="workflow-summary"><dt>${isHindi ? "यात्रा" : "Journey"}</dt><dd>${escapeWorkflowText(state.source)} → ${escapeWorkflowText(state.destination)}</dd><dt>${isHindi ? "तारीख" : "Date"}</dt><dd>${escapeWorkflowText(state.date)}</dd><dt>${isHindi ? "ट्रेन" : "Train"}</dt><dd>${escapeWorkflowText(state.selectedTrain)}</dd><dt>${isHindi ? "यात्री" : "Passenger"}</dt><dd>${escapeWorkflowText(state.passengerName)}, ${escapeWorkflowText(state.passengerAge)}</dd></dl><p class="workflow-muted">${isHindi ? "कोई भुगतान नहीं लिया जाएगा।" : "No payment will be taken."}</p>`;
        return `<h3>${isHindi ? "डेमो बुकिंग की पुष्टि" : "Confirm demo booking"}</h3><p class="workflow-muted">${isHindi ? "यह केवल अभ्यास है; कोई वास्तविक टिकट आरक्षित नहीं होगा।" : "This is practice only; no real ticket will be reserved."}</p><button id="bookingConfirm" class="workflow-action" type="button">✓ ${isHindi ? "डेमो पूरा करें" : "Finish simulation"}</button>`;
    }

    function renderDocumentStage(target) {
        guide.querySelector(".workflow-app-title").textContent = isHindi ? "Documents डेमो" : "Documents Demo";
        if (target === "documentOpen") return `<h3>${isHindi ? "आपके सिम्युलेटेड दस्तावेज़" : "Your simulated documents"}</h3><p class="workflow-muted">${isHindi ? "यहाँ नमूना दस्तावेज़ देखे जा सकते हैं।" : "Sample documents are available here."}</p><button id="documentOpen" class="workflow-action" type="button">📁 ${isHindi ? "Documents खोलें" : "Open Documents"}</button>`;
        if (target === "documentCategory") return `<h3>${isHindi ? "दस्तावेज़ की श्रेणी चुनें" : "Choose a document category"}</h3><label>${isHindi ? "श्रेणी" : "Category"}<select id="documentCategory" aria-label="${isHindi ? "दस्तावेज़ की श्रेणी" : "Document category"}"><option value="">${isHindi ? "श्रेणी चुनें" : "Choose a category"}</option><option value="bonafide">${documentLabel("bonafide")}</option><option value="marksheet">${documentLabel("marksheet")}</option><option value="id_card">${documentLabel("id_card")}</option><option value="fee_receipt">${documentLabel("fee_receipt")}</option></select></label>`;
        if (target === "documentSample") return `<h3>${isHindi ? "एक नमूना दस्तावेज़ चुनें" : "Select a sample document"}</h3><button id="documentSample" class="workflow-choice active-choice" type="button"><strong>📄 ${documentLabel(state.documentType)}</strong><span>${isHindi ? "डेमो छात्र रिकॉर्ड · नमूना" : "Demo student record · sample"}</span></button>`;
        if (target === "documentPreview") return `<h3>${isHindi ? "दस्तावेज़ का पूर्वावलोकन" : "Document preview"}</h3><div class="sample-document"><span>🎓 RAASTA · DEMO</span><strong>${documentLabel(state.documentType)}</strong><p>${isHindi ? "नमूना छात्र दस्तावेज़" : "Sample student document"}</p><small>${isHindi ? "केवल सिमुलेशन" : "SIMULATION ONLY"}</small></div><button id="documentPreview" class="workflow-action" type="button">${isHindi ? "पूर्वावलोकन देखा" : "Preview checked"}</button>`;
        return `<h3>${isHindi ? "डेमो डाउनलोड तैयार है" : "Demo download is ready"}</h3><p class="workflow-muted">${isHindi ? "कोई वास्तविक संस्थागत दस्तावेज़ डाउनलोड नहीं होगा।" : "No real institutional document will be downloaded."}</p><button id="documentDownload" class="workflow-action" type="button">⬇ ${isHindi ? "डेमो पूरा करें" : "Finish simulated download"}</button>`;
    }

    function renderPhoneStage(target) {
        guide.querySelector(".workflow-app-title").textContent = isHindi ? "फोन Settings डेमो" : "Phone Settings Demo";
        if (target === "phoneTutorialChoice") return `<h3>${isHindi ? "किस सेटिंग के बारे में सीखेंगे?" : "Which setting would you like to learn?"}</h3><div id="phoneTutorialChoice" class="phone-tutorial-choices"><button type="button" data-phone-topic="wifi">📶 ${isHindi ? "Wi-Fi जोड़ें" : "Connect to Wi-Fi"}</button><button type="button" data-phone-topic="brightness">☀️ ${isHindi ? "चमक बदलें" : "Adjust brightness"}</button><button type="button" data-phone-topic="bluetooth">ᛒ ${isHindi ? "Bluetooth चालू/बंद करें" : "Turn Bluetooth on/off"}</button></div>`;
        if (target === "phoneSettings") return `<div class="phone-settings-screen"><div class="phone-status">9:41 ▪▪▪</div><h3>⚙️ ${isHindi ? "Settings" : "Settings"}</h3><p>${isHindi ? "यह फोन का सिम्युलेटेड Settings पेज है।" : "This is a simulated phone settings screen."}</p><button id="phoneSettings" class="workflow-choice active-choice" type="button">${isHindi ? "नेटवर्क और डिस्प्ले सेटिंग्स" : "Network and display settings"} →</button></div>`;
        if (target === "phoneWifi") return `<h3>${isHindi ? "Network & Internet" : "Network & Internet"}</h3><button id="phoneWifi" class="setting-row active-choice" type="button"><span>📶 Wi-Fi</span><span>${isHindi ? "बंद" : "Off"} →</span></button>`;
        if (target === "phoneNetwork") return `<h3>${isHindi ? "Wi-Fi नेटवर्क चुनें" : "Choose a Wi-Fi network"}</h3><button id="phoneNetwork" class="setting-row active-choice" type="button">🔒 Campus Wi-Fi <span>▂▄▆</span></button><p class="workflow-muted">${isHindi ? "यह एक नमूना नेटवर्क है।" : "This is a sample network."}</p>`;
        if (target === "phoneConnect") return `<h3>Campus Wi-Fi</h3><p class="workflow-muted">${isHindi ? "सिम्युलेटेड कनेक्शन" : "Simulated connection"}</p><button id="phoneConnect" class="workflow-action" type="button">${isHindi ? "Connect" : "Connect"}</button>`;
        if (target === "phoneConnected") return `<h3>${isHindi ? "कनेक्शन स्थिति" : "Connection status"}</h3><div class="setting-row setting-result">📶 Campus Wi-Fi <strong>${state.wifiConnected ? (isHindi ? "जुड़ा हुआ" : "Connected") : (isHindi ? "तैयार" : "Ready")}</strong></div><button id="phoneConnected" class="workflow-action" type="button">${isHindi ? "स्थिति देखें" : "Check status"}</button>`;
        if (target === "phoneDisplay") return `<h3>${isHindi ? "Display सेटिंग्स" : "Display settings"}</h3><button id="phoneDisplay" class="setting-row active-choice" type="button">☀️ ${isHindi ? "चमक" : "Brightness"} →</button>`;
        if (target === "phoneBrightness") return `<h3>${isHindi ? "स्क्रीन की चमक" : "Screen brightness"}</h3><label>${isHindi ? "चमक" : "Brightness"}<input id="phoneBrightness" type="range" min="0" max="100" value="${state.brightness}" aria-label="${isHindi ? "स्क्रीन की चमक" : "Screen brightness"}"></label><p class="workflow-muted">${state.brightness}%</p>`;
        if (target === "phoneBrightnessDone") return `<h3>${isHindi ? "नई चमक" : "New brightness"}</h3><div class="setting-row setting-result">☀️ ${isHindi ? "स्क्रीन स्तर" : "Screen level"}<strong>${state.brightness}%</strong></div><button id="phoneBrightnessDone" class="workflow-action" type="button">${isHindi ? "पूरा करें" : "Finish tutorial"}</button>`;
        if (target === "phoneBluetooth") return `<h3>${isHindi ? "Connected devices" : "Connected devices"}</h3><button id="phoneBluetooth" class="setting-row active-choice" type="button">ᛒ Bluetooth <span>${state.bluetooth ? "On" : "Off"} →</span></button>`;
        if (target === "phoneToggle") return `<h3>${isHindi ? "Bluetooth" : "Bluetooth"}</h3><button id="phoneToggle" class="workflow-action" type="button">${state.bluetooth ? (isHindi ? "बंद करें" : "Turn off") : (isHindi ? "चालू करें" : "Turn on")}</button>`;
        return `<h3>Bluetooth</h3><div class="setting-row setting-result">ᛒ Bluetooth <strong>${state.bluetooth ? "On" : "Off"}</strong></div><button id="phoneBluetoothDone" class="workflow-action" type="button">${isHindi ? "पूरा करें" : "Finish tutorial"}</button>`;
    }

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
    }

    function finishWorkflow() {
        stopSpeech();
        if (activeGuidance) activeGuidance.completed = true;
        const message = plan.category === "train_booking"
            ? (isHindi ? "सिम्युलेटेड यात्रा पूरी हुई। कोई वास्तविक टिकट बुक या भुगतान नहीं हुआ।" : "Simulated journey complete. No real ticket was booked or paid for.")
            : plan.category === "document_download"
                ? (isHindi ? "डेमो पूरा हुआ। कोई वास्तविक संस्थागत दस्तावेज़ डाउनलोड नहीं हुआ।" : "Demo complete. No real institutional document was downloaded.")
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
        if (target === "trainSearch") state.searched = true;
        if (target === "trainSelect") state.selectedTrain ||= "Intercity Express";
        if (target === "phoneConnect") state.wifiConnected = true;
        if (target === "phoneToggle") state.bluetooth = !state.bluetooth;
        if (target === "bookingConfirm" || target === "documentDownload" || target === "phoneConnected" || target === "phoneBrightnessDone" || target === "phoneBluetoothDone") {
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

    if (plan && ["train_booking", "document_download", "smartphone_basics"].includes(plan.category)) {
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
                    <div class="portal-header"><strong>🎓 ${isHindi ? "छात्र पोर्टल" : "Student Portal"}</strong><span>${isHindi ? "डेमो छात्र खाता" : "Demo Student Account"}</span></div>
                    <div class="portal-body">
                        <aside class="portal-sidebar">
                            <p>${isHindi ? "मुख्य मेन्यू" : "MAIN MENU"}</p>
                            <button class="portal-option" type="button">🏠 ${isHindi ? "डैशबोर्ड" : "Dashboard"}</button>
                            <button class="portal-option" type="button">👤 ${isHindi ? "मेरी प्रोफ़ाइल" : "My Profile"}</button>
                            <button class="portal-option" id="portalDocuments" type="button">📁 ${isHindi ? "दस्तावेज़" : "Documents"}</button>
                            <button class="portal-option" type="button">💳 ${isHindi ? "फीस विवरण" : "Fee Details"}</button>
                        </aside>
                        <div class="portal-main">
                            <h3>${isHindi ? "मेरे दस्तावेज़" : "My Documents"}</h3><p>${isHindi ? "अपने कॉलेज के दस्तावेज़ यहाँ देखें।" : "Manage your college documents here."}</p>
                            <div class="document-card"><div class="document-icon">📄</div><div><strong>${isHindi ? "फीस रसीदें" : "Fee Receipts"}</strong><p>${isHindi ? "भुगतान की रसीदें देखें" : "View your payment receipts"}</p></div><button id="portalReceipts" class="portal-action" type="button">${isHindi ? "खोलें →" : "Open →"}</button></div>
                            <div class="document-card"><div class="document-icon">📋</div><div><strong>${isHindi ? "शैक्षणिक दस्तावेज़" : "Academic Documents"}</strong><p>${isHindi ? "अपने शैक्षणिक रिकॉर्ड देखें" : "View your academic records"}</p></div><button class="portal-action" type="button" disabled>${isHindi ? "खोलें →" : "Open →"}</button></div>
                            <div class="receipt-box" id="receiptBox"><h3>${isHindi ? "फीस रसीद - सेमेस्टर 1" : "Fee Receipt - Semester 1"}</h3><p>${isHindi ? "छात्र: डेमो छात्र" : "Student: Demo Student"}</p><p>${isHindi ? "स्थिति: डेमो भुगतान रिकॉर्ड" : "Status: Demo payment record"}</p><button id="portalDownload" class="download-action" type="button">⬇ ${isHindi ? "रसीद डाउनलोड करें" : "Download Receipt"}</button></div>
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
