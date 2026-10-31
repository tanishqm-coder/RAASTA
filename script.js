// =================================
// RAASTA - MAIN JAVASCRIPT
// =================================


// Get HTML elements

const taskInput = document.getElementById("taskInput");
const startBtn = document.getElementById("startBtn");
const voiceBtn = document.getElementById("voiceBtn");
const language = document.getElementById("language");
let resumeGuideAtStep = 0;

// Translate the visible interface without changing the task text or speech voices.
function applyPageLanguage() {
    const isHindi = language.value === "hi";
    const labels = isHindi ? {
        howLink: "कैसे काम करता है", heroTagline: "आपका व्यक्तिगत डिजिटल गाइड",
        heroTitle: "तकनीक होनी चाहिए", heroTitleAccent: "सबके लिए आसान।",
        heroDescription: "ऐप या वेबसाइट इस्तेमाल करने में परेशानी है? बस बताइए कि आप क्या करना चाहते हैं। हम आपको आसान चरणों में रास्ता दिखाएँगे।",
        taskLabel: "आज आप किस काम में मदद चाहते हैं?", startLabel: "मुझे गाइड करें",
        suggestionPrompt: "शुरू कहाँ से करें? इनमें से चुनें:", suggestionTrainLabel: "ट्रेन टिकट बुक करें",
        suggestionDocumentLabel: "दस्तावेज़ डाउनलोड करें", suggestionPhoneLabel: "स्मार्टफोन चलाना सीखें",
        cardWebsite: "कोई भी वेबसाइट", cardLanguage: "आपकी भाषा", cardGuidance: "चरण-दर-चरण मार्गदर्शन",
        howTitle: "बस 1, 2, 3।", howDescription: "तकनीकी विशेषज्ञ होना ज़रूरी नहीं। हम मदद करेंगे।",
        howTellTitle: "हमें बताएँ", howTellDescription: "बताएँ कि आप क्या करना चाहते हैं।",
        howUnderstandTitle: "हम समझेंगे", howUnderstandDescription: "हम आपके काम को आसान निर्देशों में बाँटेंगे।",
        howGuidedTitle: "आपको रास्ता मिलेगा", howGuidedDescription: "हर चरण अपनी गति से पूरा करें।"
    } : {
        howLink: "How it works", heroTagline: "YOUR PERSONAL DIGITAL GUIDE",
        heroTitle: "Technology should be", heroTitleAccent: "easy for everyone.",
        heroDescription: "Confused about using an app or website? Just tell us what you want to do. We'll guide you, one simple step at a time.",
        taskLabel: "What would you like help with today?", startLabel: "Guide me",
        suggestionPrompt: "Not sure where to start? Try these:", suggestionTrainLabel: "Book a train ticket",
        suggestionDocumentLabel: "Download a document", suggestionPhoneLabel: "Learn smartphone basics",
        cardWebsite: "Any website", cardLanguage: "Your language", cardGuidance: "Step-by-step guidance",
        howTitle: "Simple as 1, 2, 3.", howDescription: "You don't need to be a tech expert. We've got you covered.",
        howTellTitle: "Tell us", howTellDescription: "Describe what you want to accomplish.",
        howUnderstandTitle: "We understand", howUnderstandDescription: "We break your task into simple instructions.",
        howGuidedTitle: "You're guided", howGuidedDescription: "Follow each step at your own pace."
    };
    Object.entries(labels).forEach(([id, text]) => { document.getElementById(id).textContent = text; });
    voiceBtn.innerHTML = isHindi ? "🎤 <span id=\"voiceLabel\">बोलें</span>" : "🎤 <span id=\"voiceLabel\">Speak</span>";
    taskInput.placeholder = isHindi
        ? "उदाहरण: मुझे कॉलेज की फीस की रसीद डाउनलोड करनी है..."
        : "Example: I want to download my college fee receipt...";
    taskInput.setAttribute("aria-label", labels.taskLabel);
    document.documentElement.lang = isHindi ? "hi" : "en";
}

applyPageLanguage();

language.addEventListener("change", () => {
    applyPageLanguage();
    const guide = document.getElementById("guidePanel");
    if (guide && guide.style.display === "block" && taskInput.value.trim()) {
        const stepNumber = Number(guide.querySelector(".step-count")?.textContent.match(/\d+/)?.[0]);
        resumeGuideAtStep = Number.isFinite(stepNumber) && stepNumber > 0 ? stepNumber - 1 : 0;
        requestTaskGuide(taskInput.value.trim(), resumeGuideAtStep);
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


// Voice Input

voiceBtn.addEventListener("click", function () {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert(language.value === "hi"
            ? "इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। Chrome आज़माएँ।"
            : "Voice input is not supported in this browser. Try Chrome.");
        return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang =
        language.value === "hi" ? "hi-IN" : "en-IN";

    recognition.start();

    voiceBtn.textContent = language.value === "hi" ? "🎤 सुन रहे हैं..." : "🎤 Listening...";

    recognition.onresult = function (event) {

        taskInput.value =
            event.results[0][0].transcript;

        voiceBtn.textContent = language.value === "hi" ? "🎤 बोलें" : "🎤 Speak";

    };

    recognition.onerror = function () {

        voiceBtn.textContent = language.value === "hi" ? "🎤 बोलें" : "🎤 Speak";

        alert(language.value === "hi"
            ? "आपकी आवाज़ समझ नहीं आई। कृपया फिर से कोशिश करें।"
            : "Could not recognize your voice. Please try again.");

    };

    recognition.onend = function () {

        voiceBtn.textContent = language.value === "hi" ? "🎤 बोलें" : "🎤 Speak";

    };

});


// Text-to-Speech Function

function speakText(text) {

    const synth = window.speechSynthesis;

    if (!synth) {
        alert("Speech output is not supported.");
        return;
    }

    synth.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.rate = 0.85;
    speech.pitch = 1;
    speech.volume = 1;

    const voices = synth.getVoices();

    if (language.value === "hi") {

        const hindiVoice = voices.find(v =>
            v.lang.toLowerCase() === "hi-in"
        );

        if (!hindiVoice) {
            alert("Hindi voice not found!");
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

const supportedPortalTargets = ["portalDocuments", "portalReceipts", "portalDownload"];

function setTaskStatus(message, kind = "info") {
    const status = document.getElementById("taskStatus");
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = !message;
}

async function requestTaskGuide(task, startingStep = 0) {
    const isHindi = language.value === "hi";
    if (task.length < 4 || task.length > 500) {
        setTaskStatus(isHindi
            ? "कृपया 4 से 500 अक्षरों के बीच अपना काम लिखें।"
            : "Please enter a task between 4 and 500 characters.", "error");
        taskInput.focus();
        return;
    }

    startBtn.disabled = true;
    language.disabled = true;
    document.getElementById("startLabel").textContent = isHindi ? "समझ रहे हैं..." : "Understanding...";
    setTaskStatus(isHindi ? "आपके काम को समझा जा रहा है..." : "Understanding your task...", "loading");

    try {
        const response = await fetch("/api/understand-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, language: language.value })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Task understanding failed.");
        if (!result || typeof result !== "object" || !Array.isArray(result.steps)) {
            throw new Error("The guide service returned an invalid result.");
        }

        if (result.supported) {
            const validTargets = result.category === "fee_receipt" &&
                result.steps.length === supportedPortalTargets.length &&
                result.steps.every((step, index) =>
                    step && step.targetElementId === supportedPortalTargets[index] &&
                    typeof step.instruction === "string" && step.instruction.trim()
                );
            if (!validTargets) throw new Error("The guide included an unsupported portal target.");
        } else if (result.steps.some(step => step?.targetElementId)) {
            throw new Error("Unsupported tasks cannot target portal controls.");
        }

        if (result.mode === "demo") {
            setTaskStatus(isHindi
                ? "डेमो मोड: स्थानीय उदाहरण चल रहा है। AI API के लिए सर्वर पर OPENAI_API_KEY जोड़ें।"
                : "Demo mode: using the local example. Add OPENAI_API_KEY on the server to enable AI.", "demo");
        } else {
            setTaskStatus("");
        }

        if (result.supported) showGuide(task, result, startingStep);
        else showClarification(task, result);
    } catch (error) {
        setTaskStatus(isHindi
            ? `${error.message || "अनुरोध पूरा नहीं हो सका।"} सर्वर चल रहा है या नहीं जाँचें।`
            : `${error.message || "The request could not be completed."} Check that Raasta is running with npm start.`, "error");
    } finally {
        startBtn.disabled = false;
        language.disabled = false;
        document.getElementById("startLabel").textContent = isHindi ? "मुझे गाइड करें" : "Guide me";
    }
}

function showClarification(task, result) {
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
    guide.querySelector("#clarificationSpeak").onclick = () => speakText(guide.querySelector("#clarificationQuestion").textContent);
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


// Display Guided Experience

function showGuide(task, plan = null, startingStep = 0) {

    const isHindi = language.value === "hi";
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
        guide.querySelector("#speakBtn").onclick = () => speakText(instructions[currentStep]);
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
                    <div class="progress-bar"><div class="progress-fill"></div></div><p class="step-count"></p>
                    <h3 id="visualInstruction" aria-live="polite"></h3>
                    <button id="visualSpeak" class="voice-btn" type="button">🔊 ${isHindi ? "सुनें" : "Read aloud"}</button>
                    <div class="visual-navigation"><button id="visualPrevious" class="voice-btn" type="button">← ${isHindi ? "पिछला" : "Previous"}</button><button id="visualNext" class="start-btn" type="button">${isHindi ? "अगला →" : "Next →"}</button></div>
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
    const targetIds = steps.map(step => step.target);

    function updateStep() {
        instruction.textContent = steps[currentStep].instruction;
        stepCount.textContent = isHindi ? `चरण ${currentStep + 1} / ${steps.length}` : `Step ${currentStep + 1} of ${steps.length}`;
        progress.style.width = ((currentStep + 1) / steps.length * 100) + "%";
        previous.disabled = currentStep === 0;
        next.textContent = currentStep === steps.length - 1 ? (isHindi ? "समाप्त ✓" : "Finish ✓") : (isHindi ? "अगला →" : "Next →");
        targetIds.forEach(id => guide.querySelector(`#${id}`).classList.remove("active-target"));
        guide.querySelector(`#${steps[currentStep].target}`).classList.add("active-target");
        feedback.textContent = "";
    }

    function completeDemo() {
        guide.querySelector(".instruction-panel").innerHTML = `
            <div class="raasta-avatar">🎉</div><h2>${isHindi ? "बहुत बढ़िया!" : "Demo complete!"}</h2>
            <p>${isHindi ? "आपने सिम्युलेटेड चरण पूरे किए। कोई वास्तविक फ़ाइल डाउनलोड नहीं हुई।" : "You completed the simulated steps. No real file was downloaded."}</p>
            <button id="restartVisual" class="start-btn" type="button">${isHindi ? "फिर से शुरू करें" : "Start again"}</button>`;
        targetIds.forEach(id => guide.querySelector(`#${id}`).classList.remove("active-target"));
        guide.querySelector("#restartVisual").onclick = () => showGuide(task);
    }

    function advanceStep() {
        if (currentStep < steps.length - 1) { currentStep++; updateStep(); }
        else completeDemo();
    }

    previous.onclick = () => { if (currentStep > 0) { currentStep--; updateStep(); } };
    next.onclick = advanceStep;
    guide.querySelector("#visualSpeak").onclick = () => speakText(steps[currentStep].instruction);

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
