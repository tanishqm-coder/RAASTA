import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

function makeElement() {
    const classes = new Set();
    const listeners = new Map();
    return {
        textContent: "",
        innerHTML: "",
        value: "",
        placeholder: "",
        disabled: false,
        style: {},
        dataset: {},
        attributes: {},
        removed: false,
        listeners,
        classList: {
            add: value => classes.add(value),
            remove: value => classes.delete(value),
            contains: value => classes.has(value)
        },
        querySelectorAll: () => [],
        addEventListener: (name, handler) => listeners.set(name, handler),
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() { this.removed = true; },
        focus() {},
        scrollIntoView() {}
    };
}

async function loadFrontend({ result = null, fetchImpl = null, audioPlayFailure = false, sessionStore = new Map(), localStore = new Map(), prefersDark = true } = {}) {
    const source = await readFile(new URL("./script.js", import.meta.url), "utf8");
    const nodes = new Map();
    const initializeNode = (key, node) => {
        if (key === "guide:.workflow-screen") {
            node.querySelector = selector => getNode(`workflow:${selector}`);
            node.querySelectorAll = selector => {
                if (selector === "[data-phone-topic]") return ["wifi", "brightness", "bluetooth"].map(topic => getNode(`workflow:data-phone-topic-${topic}`));
                if (selector === "[data-train]") return [getNode("workflow:data-train-superfast")];
                return [];
            };
        }
        if (key.startsWith("workflow:#")) {
            const id = key.slice("workflow:#".length);
            node.tagName = ["trainSource", "trainDestination", "trainDate", "passengerName", "passengerAge", "phoneBrightness"].includes(id)
                ? "INPUT" : id === "documentCategory" ? "SELECT" : "BUTTON";
        }
        if (key === "guide:#phoneTutorialChoice") node.tagName = "DIV";
        if (key.startsWith("workflow:data-phone-topic-")) node.dataset.phoneTopic = key.slice("workflow:data-phone-topic-".length);
        if (key === "workflow:data-train-superfast") node.dataset.train = "Superfast Express";
    };
    const getNode = key => {
        if (!nodes.has(key)) {
            const node = makeElement();
            initializeNode(key, node);
            nodes.set(key, node);
        }
        return nodes.get(key);
    };
    const guide = getNode("guidePanel");
    guide.querySelector = selector => getNode(`guide:${selector}`);
    let guideHtml = "";
    Object.defineProperty(guide, "innerHTML", {
        get: () => guideHtml,
        set: value => {
            guideHtml = value;
            for (const key of nodes.keys()) {
                if (key.startsWith("guide:")) {
                    const node = makeElement();
                    initializeNode(key, node);
                    nodes.set(key, node);
                }
            }
        }
    });

    const voices = [{ lang: "en-IN" }, { lang: "hi-IN" }];
    const spoken = [];
    let speechCancelCount = 0;
    const speechSynthesis = {
        onvoiceschanged: null,
        getVoices: () => voices,
        cancel() { speechCancelCount += 1; },
        speak: utterance => spoken.push(utterance)
    };
    let recognition;
    let recognitionAbortCount = 0;
    const demoExamples = [
        "I want to download my fee receipt.",
        "Mujhe Jaipur se Delhi ki train book karni hai.",
        "I want to download my bonafide certificate.",
        "Mujhe Bluetooth on karna hai."
    ].map(task => {
        const button = makeElement();
        button.dataset.task = task;
        return button;
    });
    const fetchCalls = [];
    const playedAudio = [];
    const revokedUrls = [];
    let objectUrlCounter = 0;
    class FakeRecognition {
        constructor() { recognition = this; }
        start() { this.started = true; }
        abort() { recognitionAbortCount += 1; }
    }
    class FakeUtterance {
        constructor(text) { this.text = text; }
    }
    class FakeAudio {
        constructor(src) { this.src = src; this.paused = false; playedAudio.push(this); }
        async play() {
            this.played = true;
            if (audioPlayFailure) throw new Error("mock playback failure");
        }
        pause() { this.paused = true; }
        removeAttribute(name) { if (name === "src") this.src = ""; }
        load() {}
    }
    const document = {
        documentElement: getNode("html"),
        body: getNode("body"),
        getElementById: getNode,
        querySelector: getNode,
        querySelectorAll: selector => selector === ".suggestion" ? demoExamples : [],
        createElement: makeElement
    };
    const window = {
        speechSynthesis,
        Audio: FakeAudio,
        SpeechRecognition: FakeRecognition,
        webkitSpeechRecognition: undefined,
        matchMedia: query => ({ matches: query.includes("prefers-color-scheme: dark") ? prefersDark : false })
    };
    const context = vm.createContext({
        document,
        window,
        AbortController,
        SpeechSynthesisUtterance: FakeUtterance,
        URL: {
            createObjectURL: () => `blob:raasta-${++objectUrlCounter}`,
            revokeObjectURL: url => revokedUrls.push(url)
        },
        fetch: async (url, options) => {
            fetchCalls.push({ url, options });
            return fetchImpl
                ? fetchImpl(url, options)
                : { ok: true, json: async () => result, blob: async () => ({ type: "audio/mpeg" }) };
        },
        sessionStorage: {
            getItem: key => sessionStore.has(key) ? sessionStore.get(key) : null,
            setItem: (key, value) => sessionStore.set(key, String(value))
        },
        localStorage: {
            getItem: key => localStore.has(key) ? localStore.get(key) : null,
            setItem: (key, value) => localStore.set(key, String(value))
        },
        alert() {},
        console: { log() {}, warn() {}, error() {} }
    });
    vm.runInContext(source, context);
    return { context, guide, nodes, getNode, voices, spoken, speechSynthesis, fetchCalls, playedAudio, revokedUrls, sessionStore, demoExamples, get speechCancelCount() { return speechCancelCount; }, get recognitionAbortCount() { return recognitionAbortCount; }, get recognition() { return recognition; } };
}

const guidePlan = {
    task: "Download my hostel fee receipt",
    category: "fee_receipt",
    language: "en",
    instruction: "Open the fee receipt in the simulated student portal.",
    supported: true,
    steps: [
        { instruction: "Open Documents.", targetElementId: "portalDocuments" },
        { instruction: "Select Fee Receipts.", targetElementId: "portalReceipts" },
        { instruction: "Select Download Receipt.", targetElementId: "portalDownload" }
    ]
};

const universalGuidePlan = {
    task: "I want to turn on my PS5.", category: "universal_guidance", language: "en",
    device: "PlayStation 5", platform: "PlayStation 5",
    instruction: "General guidance follows; locations vary by console model.", supported: true, mode: "demo",
    steps: [
        { title: "Check the power connection", instruction: "Check the console cable and outlet." },
        { title: "Locate the power button", instruction: "Look for the power-marked button along the console front edge; its position can vary." },
        { title: "Wait for startup", instruction: "Allow the console to start and check the TV input." }
    ]
};

const workflowTargets = {
    train_booking: ["trainSource", "trainDestination", "trainDate", "trainSearch", "trainSelect", "trainPassenger", "trainReview", "bookingConfirm"],
    document_download: ["documentOpen", "documentCategory", "documentSample", "documentPreview", "documentDownload"],
    wifi: ["phoneSettings", "phoneWifi", "phoneNetwork", "phoneConnect", "phoneConnected"],
    brightness: ["phoneSettings", "phoneDisplay", "phoneBrightness", "phoneBrightnessDone"],
    bluetooth: ["phoneSettings", "phoneBluetooth", "phoneToggle", "phoneBluetoothDone"]
};

function makeWorkflowPlan(category, topic = null, overrides = {}) {
    const sequence = category === "smartphone_basics"
        ? (workflowTargets[topic] || ["phoneTutorialChoice"])
        : workflowTargets[category];
    return {
        task: category === "train_booking" ? "Book a train from Jaipur to Delhi." : `Start the ${topic || category} demo.`,
        category,
        language: "en",
        topic,
        documentType: category === "document_download" ? null : undefined,
        source: "Jaipur",
        destination: "Delhi",
        instruction: "Follow the highlighted control in this simulation.",
        supported: true,
        steps: sequence.map((targetElementId, index) => ({ instruction: `Step ${index + 1}: use ${targetElementId}.`, targetElementId })),
        ...overrides
    };
}

test("the four homepage demo examples populate the existing task input without starting a parallel flow", async () => {
    const frontend = await loadFrontend();
    const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
    const examples = [
        "I want to download my fee receipt.",
        "Mujhe Jaipur se Delhi ki train book karni hai.",
        "I want to download my bonafide certificate.",
        "Mujhe Bluetooth on karna hai."
    ];
    for (const example of examples) assert.ok(html.includes(`data-task="${example}"`), example);
    assert.equal(frontend.demoExamples.length, 4);
    for (const button of frontend.demoExamples) {
        button.listeners.get("click").call(button);
        assert.equal(frontend.getNode("taskInput").value, button.dataset.task);
        assert.equal(frontend.fetchCalls.length, 0, "examples use the existing input and Guide me action");
    }
});

test("Demo Mode can be enabled and disabled and sends its explicit local-only flag", async () => {
    const sessionStore = new Map();
    const plan = makeWorkflowPlan("smartphone_basics", "bluetooth", { task: "Mujhe Bluetooth on karna hai.", mode: "demo" });
    const frontend = await loadFrontend({ result: plan, sessionStore });
    const toggle = frontend.getNode("demoModeToggle");
    toggle.checked = true;
    toggle.listeners.get("change")({ target: toggle });
    assert.equal(sessionStore.get("raasta:demo-mode"), "true");
    assert.match(frontend.getNode("demoModeState").textContent, /On.*local guides.*Gemini will not be called/i);

    frontend.getNode("language").value = "hi";
    await frontend.context.requestTaskGuide("Mujhe Bluetooth on karna hai.");
    const request = frontend.fetchCalls[0];
    assert.equal(request.url, "/api/understand-task");
    assert.equal(JSON.parse(request.options.body).demoMode, true);
    assert.equal(frontend.guide.querySelector(".workflow-instruction").textContent.includes("Step 1"), true);
    assert.deepEqual(frontend.fetchCalls.map(call => call.url), ["/api/understand-task"], "local task understanding makes no Gemini or Sarvam request from the browser");

    frontend.getNode("language").value = "en";
    toggle.checked = false;
    toggle.listeners.get("change")({ target: toggle });
    assert.equal(sessionStore.get("raasta:demo-mode"), "false");
    assert.match(frontend.getNode("demoModeState").textContent, /Off.*AI when configured/i);
    const restored = await loadFrontend({ sessionStore });
    assert.equal(restored.getNode("demoModeToggle").checked, false);
});

test("Demo Mode opens the existing fee, train, document and Bluetooth guides from the homepage input", async () => {
    const scenarios = [
        { task: "I want to download my fee receipt.", plan: { ...guidePlan, mode: "demo" }, category: "fee_receipt", language: "en" },
        { task: "Mujhe Jaipur se Delhi ki train book karni hai.", plan: makeWorkflowPlan("train_booking", null, { mode: "demo" }), category: "train_booking", language: "hi" },
        { task: "I want to download my bonafide certificate.", plan: makeWorkflowPlan("document_download", null, { mode: "demo" }), category: "document_download", language: "en" },
        { task: "Mujhe Bluetooth on karna hai.", plan: makeWorkflowPlan("smartphone_basics", "bluetooth", { mode: "demo" }), category: "smartphone_basics", language: "hi" }
    ];
    for (const scenario of scenarios) {
        const frontend = await loadFrontend({ result: scenario.plan });
        const toggle = frontend.getNode("demoModeToggle");
        toggle.checked = true;
        toggle.listeners.get("change")({ target: toggle });
        frontend.getNode("language").value = scenario.language;
        frontend.getNode("taskInput").value = scenario.task;
        await frontend.context.requestTaskGuide(frontend.getNode("taskInput").value);
        assert.equal(JSON.parse(frontend.fetchCalls[0].options.body).demoMode, true, scenario.task);
        assert.equal(vm.runInContext("activeGuidance.category", frontend.context), scenario.category, scenario.task);
        assert.equal(frontend.fetchCalls.length, 1, "workflow launch uses one existing task-understanding request");
        assert.match(frontend.getNode("taskStatus").textContent, /Gemini कॉल नहीं हुआ|Gemini was not called/i);
    }
});

test("universal guidance uses a target-free step view and supports contextual help, navigation, repeat, and completion", async () => {
    const frontend = await loadFrontend({ result: universalGuidePlan });
    frontend.getNode("demoModeToggle").checked = true;
    frontend.getNode("language").value = "en";
    await frontend.context.requestTaskGuide(universalGuidePlan.task);
    assert.equal(vm.runInContext("activeGuidance.category", frontend.context), "universal_guidance");
    assert.equal(frontend.getNode("guide:.universal-device").textContent, "PlayStation 5 · PlayStation 5");
    assert.match(frontend.getNode("guide:.universal-step-title").textContent, /power connection/i);
    assert.match(frontend.guide.innerHTML, /does not control your device/i);
    assert.equal(frontend.getNode("guide:.universal-next").disabled, false);

    frontend.getNode("guide:.universal-help").onclick();
    assert.match(frontend.getNode("guide:.workflow-feedback").textContent, /not connected to the screen/i);
    assert.equal(vm.runInContext("activeGuidance.getCurrent().index", frontend.context), 0, "help must not advance the guide");
    vm.runInContext('handleGuideFollowUp("I\'m stuck. Where do I click?")', frontend.context);
    assert.match(frontend.getNode("guide:.workflow-feedback").textContent, /cannot see its screen/i);
    assert.doesNotMatch(frontend.getNode("guide:.workflow-feedback").textContent, /yellow highlighted/i);
    assert.equal(vm.runInContext("activeGuidance.getCurrent().index", frontend.context), 0, "natural-language help must preserve universal progress");
    frontend.getNode("guide:.repeat-instruction").onclick();
    assert.ok(frontend.spoken.some(utterance => /console cable/i.test(utterance.text)));

    frontend.getNode("guide:.universal-next").onclick();
    assert.equal(vm.runInContext("activeGuidance.getCurrent().index", frontend.context), 1);
    frontend.getNode("guide:.universal-previous").onclick();
    assert.equal(vm.runInContext("activeGuidance.getCurrent().index", frontend.context), 0);
    frontend.getNode("guide:.universal-restart").onclick();
    assert.equal(vm.runInContext("activeGuidance.getCurrent().index", frontend.context), 0);

    vm.runInContext("activeGuidance.next()", frontend.context);
    vm.runInContext("activeGuidance.next()", frontend.context);
    vm.runInContext("activeGuidance.next()", frontend.context);
    assert.equal(vm.runInContext("activeGuidance.completed", frontend.context), true);
    assert.match(frontend.getNode("guide:.workflow-feedback").textContent, /No settings were changed/i);
    vm.runInContext("activeGuidance.restart()", frontend.context);
    assert.equal(vm.runInContext("activeGuidance.completed", frontend.context), false);
    assert.equal(vm.runInContext("activeGuidance.getCurrent().index", frontend.context), 0);
});

test("universal guidance updates with Beginner and Experienced modes, remains theme-safe, and resets cleanly", async () => {
    const frontend = await loadFrontend({ result: universalGuidePlan });
    frontend.getNode("demoModeToggle").checked = true;
    await frontend.context.requestTaskGuide(universalGuidePlan.task);
    const instruction = frontend.getNode("guide:.universal-step-instruction");
    assert.match(instruction.textContent, /Focus on this one action/i);

    const mode = frontend.getNode("guidanceMode");
    mode.value = "experienced";
    mode.listeners.get("change")({ target: mode });
    assert.doesNotMatch(instruction.textContent, /Focus on this one action/i);
    assert.match(instruction.textContent, /console cable/i);

    frontend.getNode("themeToggle").listeners.get("click")();
    assert.equal(frontend.getNode("html").attributes["data-theme"], "light");
    assert.equal(vm.runInContext("activeGuidance.category", frontend.context), "universal_guidance", "changing theme must not restart the guide");
    assert.equal(vm.runInContext("activeGuidance.getCurrent().index", frontend.context), 0);

    frontend.getNode("demoResetBtn").listeners.get("click")();
    assert.equal(frontend.guide.removed, true);
    assert.equal(vm.runInContext("activeGuidance", frontend.context), null);
    assert.equal(frontend.getNode("guidanceMode").value, "experienced");
    assert.equal(frontend.getNode("demoModeToggle").checked, true, "reset preserves presenter preferences");
});

test("universal Hindi instructions use Sarvam first and preserve browser TTS fallback", async () => {
    const hindiPlan = {
        ...universalGuidePlan,
        task: "Mujhe PS5 chalu karna hai.", language: "hi", device: "PlayStation 5",
        steps: [
            { title: "बिजली जाँचें", instruction: "PS5 की पावर केबल ठीक से लगी है या नहीं देखें।" },
            { title: "पावर बटन दबाएँ", instruction: "कंसोल का पावर बटन एक बार दबाएँ।" }
        ]
    };
    const frontend = await loadFrontend({ result: hindiPlan });
    frontend.getNode("language").value = "hi";
    await frontend.context.requestTaskGuide(hindiPlan.task);
    frontend.getNode("guide:.repeat-instruction").onclick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frontend.fetchCalls[0].url, "/api/understand-task");
    assert.ok(frontend.fetchCalls.some(call => call.url === "/api/speech/hindi"), "Hindi read-aloud requests Sarvam audio");
    assert.equal(frontend.playedAudio.length, 1);
    assert.equal(vm.runInContext("activeGuidance.category", frontend.context), "universal_guidance");

    const fallback = await loadFrontend({ result: hindiPlan, fetchImpl: async (url) => {
        if (url === "/api/speech/hindi") throw new Error("mock Sarvam unavailable");
        return { ok: true, json: async () => hindiPlan };
    } });
    fallback.getNode("language").value = "hi";
    await fallback.context.requestTaskGuide(hindiPlan.task);
    fallback.getNode("guide:.repeat-instruction").onclick();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(fallback.spoken.some(utterance => /पावर केबल/.test(utterance.text)), "browser Hindi speech is used when Sarvam fails");
});

test("theme selection respects first-visit system preference and persists without restarting a guide", async () => {
    const localStore = new Map();
    const frontend = await loadFrontend({ localStore, prefersDark: false });
    const root = frontend.getNode("html");
    const toggle = frontend.getNode("themeToggle");
    assert.equal(root.attributes["data-theme"], "light", "first visit follows the system light preference");
    assert.equal(frontend.getNode("themeToggleLabel").textContent, "Light");

    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    frontend.guide.querySelector("#visualNext").onclick();
    const currentStep = frontend.guide.querySelector(".step-count").textContent;
    const requestCount = frontend.fetchCalls.length;
    toggle.listeners.get("click")();
    assert.equal(root.attributes["data-theme"], "dark");
    assert.equal(localStore.get("raasta:theme"), "dark");
    assert.equal(frontend.guide.querySelector(".step-count").textContent, currentStep);
    assert.equal(frontend.fetchCalls.length, requestCount, "theme switching does not resubmit or reset the workflow");

    const restored = await loadFrontend({ localStore, prefersDark: false });
    assert.equal(restored.getNode("html").attributes["data-theme"], "dark", "a saved selection wins over later OS changes");
    restored.getNode("language").value = "hi";
    restored.context.applyPageLanguage();
    assert.equal(restored.getNode("themeToggleLabel").textContent, "गहरी");
    assert.equal(restored.getNode("themeToggle").attributes["aria-label"], "हल्की थीम चालू करें");

    const systemDark = await loadFrontend({ prefersDark: true });
    assert.equal(systemDark.getNode("html").attributes["data-theme"], "dark", "an unsaved first visit follows a dark system preference");
});

test("theme stylesheet defines coordinated dark and light palettes and reduced-motion support", async () => {
    const stylesheet = await readFile(new URL("./style.css", import.meta.url), "utf8");
    assert.match(stylesheet, /:root\[data-theme="dark"\]/);
    assert.match(stylesheet, /:root\[data-theme="light"\]/);
    assert.match(stylesheet, /prefers-color-scheme:\s*light/);
    assert.match(stylesheet, /prefers-reduced-motion:\s*reduce/);
    assert.match(stylesheet, /max-width:\s*360px/);
    assert.match(stylesheet, /\.universal-layout\s*\{[^}]*grid-template-columns/s);
    assert.match(stylesheet, /@media\s*\(max-width:\s*940px\)[\s\S]*?\.universal-layout\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.match(stylesheet, /\.universal-step-list/);
});

test("demo reset clears temporary guide, request, speech and listening state while preserving preferences", async () => {
    const sessionStore = new Map([
        ["raasta:text-size", "extra-large"],
        ["raasta:high-contrast", "true"],
        ["raasta:speech-speed", "1.25"],
        ["raasta:guidance-mode", "experienced"],
        ["raasta:demo-mode", "true"]
    ]);
    const frontend = await loadFrontend({ sessionStore });
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    frontend.context.speakText("Current instruction");
    frontend.getNode("voiceBtn").listeners.get("click")();
    frontend.getNode("taskInput").value = "temporary follow-up";
    const reset = frontend.getNode("demoResetBtn");
    reset.listeners.get("click")();

    assert.equal(frontend.guide.removed, true);
    assert.equal(vm.runInContext("activeGuidance", frontend.context), null);
    assert.equal(frontend.getNode("taskInput").value, "");
    assert.equal(frontend.getNode("startBtn").disabled, false);
    assert.equal(frontend.getNode("language").disabled, false);
    assert.equal(frontend.getNode("demoModeToggle").checked, true);
    assert.equal(frontend.getNode("body").classList.contains("text-size-extra-large"), true);
    assert.equal(frontend.getNode("body").classList.contains("high-contrast"), true);
    assert.equal(frontend.getNode("speechSpeed").value, "1.25");
    assert.equal(frontend.getNode("guidanceMode").value, "experienced");
    assert.equal(sessionStore.get("raasta:demo-mode"), "true");
    assert.ok(frontend.speechCancelCount > 0);
    assert.equal(frontend.recognitionAbortCount, 1);
    const resetMessage = frontend.getNode("taskStatus").textContent;
    frontend.recognition.onerror({ error: "aborted" });
    assert.equal(frontend.getNode("taskStatus").textContent, resetMessage, "late microphone callbacks cannot overwrite the reset message");
    assert.match(resetMessage, /Demo reset.*preferences are preserved/i);
});

test("reset aborts a pending task request so an old response cannot reopen the guide", async () => {
    let requestSignal;
    const frontend = await loadFrontend({
        fetchImpl: (_url, options) => {
            requestSignal = options.signal;
            return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
        }
    });
    const pending = frontend.context.requestTaskGuide("I want to download my fee receipt.");
    assert.equal(frontend.getNode("startBtn").disabled, true);
    frontend.context.resetDemo();
    await pending;
    assert.equal(requestSignal.aborted, true);
    assert.equal(frontend.guide.removed, true);
    assert.equal(frontend.getNode("taskInput").value, "");
    assert.match(frontend.getNode("taskStatus").textContent, /Demo reset/);
});

test("visual guide navigation reveals the download control, completes safely, and restarts the same plan", async () => {
    const frontend = await loadFrontend();
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    const query = selector => frontend.guide.querySelector(selector);
    const next = query("#visualNext");
    const previous = query("#visualPrevious");

    assert.equal(query("#visualInstruction").textContent, "Open Documents.");
    assert.equal(query("#portalDocuments").classList.contains("active-target"), true);
    query("#visualSpeak").onclick();
    assert.match(frontend.spoken.at(-1).text, /yellow highlighted.*Open Documents.*Open Documents\./i);
    assert.equal(frontend.spoken.at(-1).lang, "en-IN");
    next.onclick();
    assert.equal(query("#visualInstruction").textContent, "Select Fee Receipts.");
    previous.onclick();
    assert.equal(query("#visualInstruction").textContent, "Open Documents.");
    next.onclick();
    next.onclick();
    assert.equal(query("#visualInstruction").textContent, "Select Download Receipt.");
    assert.equal(query("#receiptBox").classList.contains("receipt-visible"), true);
    query("#portalDownload").onclick();
    assert.match(query(".instruction-panel").innerHTML, /Demo complete!/);
    assert.match(query(".instruction-panel").innerHTML, /No real file was downloaded/);

    query("#restartVisual").onclick();
    assert.equal(query("#visualInstruction").textContent, "Open Documents.");
    assert.equal(query("#portalDocuments").classList.contains("active-target"), true);
});

test("Guide me submits the entered task and opens the supported simulated guide", async () => {
    const demoPlan = { ...guidePlan, mode: "demo" };
    const frontend = await loadFrontend({ result: demoPlan });
    frontend.nodes.get("language").value = "en";
    frontend.nodes.get("taskInput").value = "Hostel fees bhar di, receipt kahan milegi?";
    frontend.nodes.get("startBtn").listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(frontend.fetchCalls.length, 1);
    assert.equal(frontend.fetchCalls[0].url, "/api/understand-task");
    assert.match(frontend.fetchCalls[0].options.body, /Hostel fees bhar di/);
    assert.equal(frontend.guide.style.display, "block");
    assert.equal(frontend.guide.querySelector("#visualInstruction").textContent, "Open Documents.");
    assert.match(frontend.nodes.get("taskStatus").textContent, /local example/i);
});

test("ambiguous and unsupported responses render a useful clarification without portal controls", async () => {
    const result = {
        task: "My money was deducted but I cannot find the receipt.",
        category: "unsupported",
        language: "en",
        instruction: "",
        steps: [],
        clarifyingQuestion: "Which fee did you pay—hostel, tuition, semester, or another college fee?",
        supported: false,
        mode: "demo"
    };
    const frontend = await loadFrontend({ result });
    frontend.nodes.get("language").value = "en";
    frontend.nodes.get("taskInput").value = result.task;
    frontend.nodes.get("startBtn").listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(frontend.guide.style.display, "block");
    assert.equal(frontend.guide.querySelector("#clarificationQuestion").textContent, result.clarifyingQuestion);
    assert.equal(frontend.guide.querySelector("#visualInstruction").textContent, "");
    assert.deepEqual(result.steps, []);
});

test("portal button path exposes the receipt and ends in the disclosed demo completion state", async () => {
    const frontend = await loadFrontend();
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    const query = selector => frontend.guide.querySelector(selector);

    assert.equal(query(".current-step-title").textContent, "Open Documents");
    assert.equal(frontend.getNode("guide:.progress-bar").attributes["aria-valuenow"], "33");
    query("#visualHelp").onclick();
    assert.match(query("#portalFeedback").textContent, /highlighted.*Documents/i);
    assert.match(frontend.guide.innerHTML, /Repeat instruction/i);

    query("#portalDocuments").onclick();
    assert.equal(query("#visualInstruction").textContent, "Select Fee Receipts.");
    assert.equal(query(".current-step-title").textContent, "Choose Fee Receipts");
    query("#portalReceipts").onclick();
    assert.equal(query("#receiptBox").classList.contains("receipt-visible"), true);
    query("#portalDownload").onclick();
    assert.match(query(".instruction-panel").innerHTML, /Demo complete!/);
    assert.match(query(".instruction-panel").innerHTML, /No real file was downloaded/);
});

test("train booking simulation supports route entry, date, search, selection, passenger review, completion and restart", async () => {
    const frontend = await loadFrontend();
    const plan = makeWorkflowPlan("train_booking");
    frontend.context.showGuide(plan.task, plan, 0);
    const guide = frontend.guide;
    const screen = frontend.getNode("guide:.workflow-screen");
    const next = guide.querySelector("#workflowNext");
    assert.equal(guide.querySelector(".workflow-step-title").textContent, "Enter your starting city");
    assert.equal(frontend.getNode("guide:.progress-bar").attributes["aria-valuenow"], "13");
    guide.querySelector("#workflowHelp").onclick();
    assert.match(guide.querySelector(".workflow-feedback").textContent, /highlighted.*starting city/i);
    assert.match(guide.innerHTML, /Repeat instruction/i);

    assert.equal(frontend.getNode("workflow:#trainSource").value, "Jaipur");
    frontend.getNode("workflow:#trainSource").value = "Udaipur";
    next.onclick();
    assert.equal(guide.querySelector(".workflow-instruction").textContent, "Step 2: use trainDestination.");
    guide.querySelector("#workflowPrevious").onclick();
    assert.equal(guide.querySelector(".workflow-instruction").textContent, "Step 1: use trainSource.");
    assert.equal(frontend.getNode("workflow:#trainSource").value, "Udaipur");
    next.onclick();
    frontend.getNode("workflow:#trainDestination").value = "Agra";
    next.onclick();
    frontend.getNode("workflow:#trainDate").value = "2027-01-10";
    next.onclick();
    assert.match(screen.innerHTML, /Udaipur → Agra/);
    frontend.getNode("workflow:#trainSearch").onclick();
    assert.match(screen.innerHTML, /Intercity Express/);
    frontend.getNode("workflow:#trainSelect").onclick();
    frontend.getNode("workflow:#passengerName").value = "Demo Learner";
    frontend.getNode("workflow:#passengerAge").value = "21";
    frontend.getNode("workflow:#trainPassenger").onclick();
    assert.match(screen.innerHTML, /Demo Learner/);
    assert.match(screen.innerHTML, /2027-01-10/);
    next.onclick();
    frontend.getNode("workflow:#bookingConfirm").onclick();
    assert.match(screen.innerHTML, /No real ticket was booked/);

    guide.querySelector("#workflowAgain").onclick();
    assert.match(screen.innerHTML, /Where will you start/);
    assert.equal(guide.querySelector(".workflow-instruction").textContent, "Step 1: use trainSource.");
});

test("document download simulation asks for a category, previews a sample and completes without a real document", async () => {
    const frontend = await loadFrontend();
    const plan = makeWorkflowPlan("document_download");
    frontend.context.showGuide(plan.task, plan, 0);
    const guide = frontend.guide;
    const screen = frontend.getNode("guide:.workflow-screen");
    const next = guide.querySelector("#workflowNext");
    assert.equal(guide.querySelector(".workflow-step-title").textContent, "Open Documents");
    assert.equal(frontend.getNode("guide:.progress-bar").attributes["aria-valuenow"], "20");

    frontend.getNode("workflow:#documentOpen").onclick();
    assert.match(screen.innerHTML, /Choose a document category/);
    assert.equal(guide.querySelector(".workflow-step-title").textContent, "Choose a document category");
    assert.equal(frontend.getNode("guide:.progress-bar").attributes["aria-valuenow"], "40");
    frontend.getNode("workflow:#documentCategory").value = "marksheet";
    frontend.getNode("workflow:#documentCategory").listeners.get("change")();
    next.onclick();
    assert.match(screen.innerHTML, /Marksheet/);
    frontend.getNode("workflow:#documentSample").onclick();
    assert.match(screen.innerHTML, /Document preview/);
    frontend.getNode("workflow:#documentPreview").onclick();
    frontend.getNode("workflow:#documentDownload").onclick();
    assert.match(screen.innerHTML, /No real institutional document was downloaded/);
});

test("document workflow preserves a requested document type such as bonafide certificate", async () => {
    const frontend = await loadFrontend();
    const plan = makeWorkflowPlan("document_download", null, { documentType: "bonafide" });
    frontend.context.showGuide(plan.task, plan, 0);
    const next = frontend.guide.querySelector("#workflowNext");
    frontend.getNode("workflow:#documentOpen").onclick();
    next.onclick();
    assert.match(frontend.getNode("guide:.workflow-screen").innerHTML, /Bonafide Certificate/);
});

test("Guide me routes a local document request into the interactive document workflow", async () => {
    const plan = makeWorkflowPlan("document_download", null, { mode: "demo" });
    const frontend = await loadFrontend({ result: plan });
    frontend.nodes.get("language").value = "en";
    frontend.nodes.get("taskInput").value = "Mujhe apna document download karna hai.";
    frontend.nodes.get("startBtn").listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frontend.guide.style.display, "block");
    assert.equal(frontend.guide.querySelector("#workflowNext").disabled, false);
    assert.match(frontend.getNode("guide:.workflow-screen").innerHTML, /simulated documents/i);
    assert.match(frontend.nodes.get("taskStatus").textContent, /local example/i);
});

test("smartphone Wi-Fi, brightness and Bluetooth tutorials highlight controls and finish safely", async () => {
    const scenarios = [
        { topic: "wifi", finalTarget: "phoneConnected", expected: /actual phone settings were not changed/i },
        { topic: "brightness", finalTarget: "phoneBrightnessDone", expected: /actual phone settings were not changed/i },
        { topic: "bluetooth", finalTarget: "phoneBluetoothDone", expected: /actual phone settings were not changed/i }
    ];
    for (const scenario of scenarios) {
        const frontend = await loadFrontend();
        const plan = makeWorkflowPlan("smartphone_basics", scenario.topic);
        frontend.context.showGuide(plan.task, plan, 0);
        const guide = frontend.guide;
        const screen = frontend.getNode("guide:.workflow-screen");
        const next = guide.querySelector("#workflowNext");
        assert.equal(guide.querySelector(`#${plan.steps[0].targetElementId}`).classList.contains("active-target"), true);
        assert.equal(guide.querySelector(".workflow-step-title").textContent, "Open Settings");
        assert.equal(frontend.getNode("guide:.progress-bar").attributes["aria-valuenow"], scenario.topic === "wifi" ? "20" : "25");

        if (scenario.topic === "wifi") {
            next.onclick();
            next.onclick();
            next.onclick();
            assert.match(screen.innerHTML, /Campus Wi-Fi/);
            next.onclick();
            assert.match(screen.innerHTML, /Connected/);
        } else if (scenario.topic === "brightness") {
            next.onclick();
            next.onclick();
            frontend.getNode("workflow:#phoneBrightness").value = "78";
            frontend.getNode("workflow:#phoneBrightness").listeners.get("input")();
            next.onclick();
            assert.match(screen.innerHTML, /78%/);
        } else {
            next.onclick();
            next.onclick();
            frontend.getNode("workflow:#phoneToggle").onclick();
            assert.match(screen.innerHTML, /On/);
        }
        frontend.getNode(`workflow:#${scenario.finalTarget}`).onclick();
        assert.match(screen.innerHTML, scenario.expected);
        guide.querySelector("#workflowRestart").onclick();
        assert.equal(guide.querySelector(".workflow-instruction").textContent, "Step 1: use phoneSettings.");
    }
});

test("generic smartphone request opens the tutorial picker and switches to the chosen interactive tutorial", async () => {
    const frontend = await loadFrontend();
    const plan = makeWorkflowPlan("smartphone_basics");
    frontend.context.showGuide(plan.task, plan, 0);
    assert.match(frontend.getNode("guide:.workflow-screen").innerHTML, /Which setting would you like to learn/);
    frontend.getNode("workflow:data-phone-topic-wifi").listeners.get("click")();
    assert.match(frontend.getNode("guide:.workflow-screen").innerHTML, /simulated phone settings/i);
    assert.equal(frontend.guide.querySelector(".workflow-instruction").textContent, "Open simulated Settings.");
});

test("contextual help uses the actual highlighted step in all four workflows without advancing", async () => {
    const scenarios = [
        { plan: guidePlan, target: "Documents" },
        { plan: makeWorkflowPlan("train_booking"), target: "starting city" },
        { plan: makeWorkflowPlan("document_download"), target: "Open Documents" },
        { plan: makeWorkflowPlan("smartphone_basics", "bluetooth"), target: "Open Settings" }
    ];
    for (const scenario of scenarios) {
        const frontend = await loadFrontend();
        frontend.nodes.get("language").value = "en";
        frontend.context.showGuide(scenario.plan.task, scenario.plan, 0);
        const guide = frontend.guide;
        const before = guide.querySelector(".step-count").textContent;
        frontend.nodes.get("taskInput").value = "Where do I click?";
        frontend.nodes.get("startBtn").listeners.get("click")();
        assert.match(guide.querySelector(scenario.plan.category === "fee_receipt" ? "#portalFeedback" : ".workflow-feedback").textContent, new RegExp(scenario.target, "i"));
        assert.equal(guide.querySelector(".step-count").textContent, before, "help must not advance the active step");
        assert.equal(frontend.spoken.at(-1).lang, "en-IN");
    }
});

test("English, Hindi, and Hinglish confusion requests explain the current step and preserve progress", async () => {
    const cases = [
        ["I don't understand.", "en", /yellow highlighted.*Open Documents/i],
        ["Mujhe samajh nahi aaya.", "hi", /हाइलाइट.*दस्तावेज़ खोलें/i],
        ["मुझे समझ नहीं आया।", "hi", /हाइलाइट.*दस्तावेज़ खोलें/i],
        ["Thoda simple batao.", "hi", /दस्तावेज़ खोलें/i],
        ["Ye option nahi mil raha.", "hi", /दस्तावेज़ खोलें.*हाइलाइट/i],
        ["Ab kya karna hai?", "hi", /दस्तावेज़ खोलें/i]
    ];
    for (const [prompt, selectedLanguage, expected] of cases) {
        const frontend = await loadFrontend();
        frontend.nodes.get("language").value = selectedLanguage;
        frontend.context.showGuide(guidePlan.task, guidePlan, 0);
        frontend.nodes.get("taskInput").value = prompt;
        frontend.nodes.get("startBtn").listeners.get("click")();
        assert.match(frontend.guide.querySelector("#portalFeedback").textContent, expected, prompt);
        assert.match(frontend.guide.querySelector(".step-count").textContent, /Step 1 of 3|चरण 1 \/ 3/, "the request stays on the same step");
        if (selectedLanguage === "hi") {
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(frontend.fetchCalls.at(-1).url, "/api/speech/hindi");
        }
    }
});

test("natural-language Previous, Next, Repeat, and Restart reuse guide navigation", async () => {
    const frontend = await loadFrontend();
    frontend.nodes.get("language").value = "en";
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    const submit = text => {
        frontend.nodes.get("taskInput").value = text;
        frontend.nodes.get("startBtn").listeners.get("click")();
    };
    submit("Next");
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 2 of 3");
    submit("Repeat");
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 2 of 3");
    assert.match(frontend.spoken.at(-1).text, /Fee Receipts/);
    submit("Can you explain again?");
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 2 of 3");
    submit("Mujhe pichhe jaana hai");
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 1 of 3");
    submit("Agla step");
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 2 of 3");
    submit("Start again");
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 1 of 3");
});

test("natural-language restart also works after the simulated completion screen", async () => {
    const frontend = await loadFrontend();
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    frontend.guide.querySelector("#visualNext").onclick();
    frontend.guide.querySelector("#visualNext").onclick();
    frontend.guide.querySelector("#visualNext").onclick();
    assert.match(frontend.guide.querySelector(".instruction-panel").innerHTML, /Demo complete!/);
    frontend.nodes.get("taskInput").value = "Start again";
    frontend.nodes.get("startBtn").listeners.get("click")();
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 1 of 3");
});

test("a clear new task automatically switches universal guidance in either direction", async () => {
    const tvPlan = {
        task: "muje tv chalu karni hai", category: "universal_guidance", language: "hi", device: "TV",
        instruction: "सामान्य निर्देश।", supported: true, mode: "demo",
        steps: [
            { title: "बिजली जाँचें", instruction: "TV की cable जाँचें।" },
            { title: "Power नियंत्रण ढूँढें", instruction: "Remote या physical button देखें।" },
            { title: "TV चालू करें", instruction: "Power एक बार दबाएँ।" },
            { title: "स्थिति देखें", instruction: "Power light जाँचें।" }
        ]
    };
    const ps5Plan = { ...universalGuidePlan, task: "Turn on my PS5." };
    const frontend = await loadFrontend({ fetchImpl: async (_url, options) => {
        const request = JSON.parse(options.body);
        return { ok: true, json: async () => request.task.toLowerCase().includes("tv") ? tvPlan : ps5Plan };
    } });
    frontend.nodes.get("language").value = "hi";
    frontend.context.applyPageLanguage();
    frontend.context.showGuide(ps5Plan.task, ps5Plan, 0);

    frontend.nodes.get("taskInput").value = "muje tv chalu karni hai";
    frontend.nodes.get("startBtn").listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(frontend.guide.querySelector(".universal-step-title").textContent, /बिजली जाँचें/);
    assert.equal(JSON.parse(frontend.fetchCalls[0].options.body).task, "muje tv chalu karni hai");

    frontend.nodes.get("taskInput").value = "Turn on my PS5.";
    frontend.nodes.get("startBtn").listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frontend.guide.querySelector(".universal-step-title").textContent, "Check the power connection");
    assert.equal(frontend.fetchCalls.length, 2);
});

test("new tasks from a specialised guide switch automatically without requiring a prefix", async () => {
    const laptopPlan = {
        task: "Connect my laptop to Bluetooth headphones.", category: "universal_guidance", language: "en", device: "computer",
        instruction: "General guidance.", supported: true,
        steps: [
            { title: "Pair headphones", instruction: "Put headphones in pairing mode." },
            { title: "Open Bluetooth", instruction: "Open Bluetooth settings." }
        ]
    };
    const frontend = await loadFrontend({ result: laptopPlan });
    frontend.context.showGuide(guidePlan.task, guidePlan, 1);
    frontend.nodes.get("taskInput").value = laptopPlan.task;
    frontend.nodes.get("startBtn").listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frontend.fetchCalls.length, 1);
    assert.equal(frontend.guide.querySelector(".universal-step-title").textContent, "Pair headphones");
    assert.equal(JSON.parse(frontend.fetchCalls[0].options.body).task, laptopPlan.task);
});

test("contextual commands stay on the current guide; an ambiguous device mention asks one clarification", async () => {
    const frontend = await loadFrontend();
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    const submit = text => {
        frontend.nodes.get("taskInput").value = text;
        frontend.nodes.get("startBtn").listeners.get("click")();
    };
    for (const text of ["I'm stuck.", "Explain this.", "Where do I click?", "Repeat"]) {
        submit(text);
        assert.equal(frontend.fetchCalls.length, 0, text);
        assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 1 of 3", text);
    }
    submit("Restart");
    assert.equal(frontend.fetchCalls.length, 0, "the bare Restart command uses the existing guide restart action");
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 1 of 3");
    for (const prompt of ["TV", "TV on?"]) {
        submit(prompt);
        assert.equal(frontend.fetchCalls.length, 0, prompt);
        assert.match(frontend.guide.querySelector("#portalFeedback").textContent, /what would you like to do/i, prompt);
        assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 1 of 3", prompt);
    }
});

test("unsupported new task responses keep the existing guide and current step", async () => {
    const unsupported = { task: "Turn on a desktop router", category: "unsupported", language: "en", instruction: "", steps: [], supported: false, clarifyingQuestion: "Which router model do you have?" };
    const frontend = await loadFrontend({ result: unsupported });
    frontend.context.showGuide(guidePlan.task, guidePlan, 1);
    frontend.nodes.get("taskInput").value = "Turn on my router.";
    frontend.nodes.get("startBtn").listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 2 of 3");
    assert.match(frontend.guide.querySelector("#portalFeedback").textContent, /router model/i);

    frontend.nodes.get("taskInput").value = "Restart my TV.";
    frontend.nodes.get("startBtn").listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frontend.fetchCalls.length, 2, "a device restart request is not mistaken for restarting the guide");
    assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 2 of 3");
});

test("ambiguous and unrelated follow-ups preserve progress; a clear new task switches guides", async () => {
    const frontend = await loadFrontend({ fetchImpl: async () => ({ ok: true, json: async () => makeWorkflowPlan("document_download") }) });
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    for (const prompt of ["Help", "What is the weather today?"]) {
        frontend.nodes.get("taskInput").value = prompt;
        frontend.nodes.get("startBtn").listeners.get("click")();
        assert.match(frontend.guide.querySelector("#portalFeedback").textContent, /would you like|about.*step|current step/i, prompt);
        assert.equal(frontend.guide.querySelector(".step-count").textContent, "Step 1 of 3");
    }
    frontend.nodes.get("taskInput").value = "I want to download my marksheet";
    frontend.nodes.get("startBtn").listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frontend.fetchCalls.length, 1);
    assert.equal(frontend.guide.querySelector(".workflow-step-title").textContent, "Open Documents");
});

test("Beginner and Experienced modes update the current step and persist for the session", async () => {
    const sessionStore = new Map();
    const frontend = await loadFrontend({ sessionStore });
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    const guide = frontend.guide;
    const mode = frontend.getNode("guidanceMode");
    assert.equal(mode.value, "beginner");
    assert.match(guide.querySelector(".guidance-detail").textContent, /yellow highlighted.*one step/i);
    mode.value = "experienced";
    mode.listeners.get("change")({ target: mode });
    assert.equal(guide.querySelector(".guidance-detail").textContent, "");
    assert.equal(guide.querySelector(".step-count").textContent, "Step 1 of 3");
    assert.equal(sessionStore.get("raasta:guidance-mode"), "experienced");
    frontend.nodes.get("taskInput").value = "I don't understand";
    frontend.nodes.get("startBtn").listeners.get("click")();
    assert.match(guide.querySelector("#portalFeedback").textContent, /yellow highlighted.*Open Documents/i, "a confused user still gets a one-time detailed explanation");
    assert.equal(guide.querySelector(".guidance-detail").textContent, "", "one-time help does not silently change Experienced mode");

    const restored = await loadFrontend({ sessionStore });
    assert.equal(restored.getNode("guidanceMode").value, "experienced");
});

test("mocked speech controls choose the selected recognition and synthesis languages", async () => {
    const frontend = await loadFrontend();
    const language = frontend.nodes.get("language");
    const voiceButton = frontend.nodes.get("voiceBtn");

    language.value = "en";
    voiceButton.listeners.get("click")();
    assert.equal(frontend.recognition.lang, "en-IN");
    assert.equal(frontend.recognition.started, true);
    assert.equal(voiceButton.attributes["aria-pressed"], "true");
    frontend.recognition.onresult({ results: [[{ transcript: "Find my hostel receipt" }]] });
    assert.equal(frontend.nodes.get("taskInput").value, "Find my hostel receipt");
    assert.match(frontend.nodes.get("taskStatus").textContent, /Recognized:.*Find my hostel receipt.*Guide me/);
    assert.equal(voiceButton.attributes["aria-pressed"], "true");
    frontend.recognition.onerror({ error: "not-allowed" });
    assert.match(frontend.nodes.get("taskStatus").textContent, /Allow microphone access/);
    assert.equal(voiceButton.disabled, false);

    language.value = "hi";
    frontend.context.applyPageLanguage();
    assert.equal(frontend.nodes.get("html").lang, "hi");
    assert.equal(language.attributes["aria-label"], "इंटरफ़ेस की भाषा");
    assert.match(frontend.nodes.get("taskInput").placeholder, /उदाहरण/);
    voiceButton.listeners.get("click")();
    assert.equal(frontend.recognition.lang, "hi-IN");
    frontend.recognition.onresult({ results: [[{ transcript: "Maine semester fees jama kar di hai" }]] });
    assert.equal(frontend.nodes.get("taskInput").value, "Maine semester fees jama kar di hai");
    assert.match(frontend.nodes.get("taskStatus").textContent, /पहचाना गया/);
    frontend.recognition.onend();
    assert.equal(voiceButton.attributes["aria-pressed"], "false");
    await frontend.context.speakText("हॉस्टल फीस की रसीद");
    assert.equal(frontend.fetchCalls.at(-1).url, "/api/speech/hindi");
    assert.equal(frontend.playedAudio.length, 1);
    language.value = "en";
    frontend.context.applyPageLanguage();
    assert.equal(frontend.nodes.get("html").lang, "en");
    const ttsCallsBeforeEnglish = frontend.fetchCalls.filter(call => call.url === "/api/speech/hindi").length;
    frontend.context.speakText("Fee receipt");
    assert.equal(frontend.spoken.at(-1).lang, "en-IN");
    assert.equal(frontend.spoken.at(-1).rate, 0.85, "default English speech speed preserves the existing pace");
    assert.equal(frontend.fetchCalls.filter(call => call.url === "/api/speech/hindi").length, ttsCallsBeforeEnglish, "English TTS remains browser-only");
});

test("accessibility controls update text size, contrast, and session-persisted settings", async () => {
    const sessionStore = new Map();
    const frontend = await loadFrontend({ sessionStore });
    frontend.getNode("textSizeLarge").listeners.get("click")();
    assert.equal(frontend.getNode("body").classList.contains("text-size-large"), true);
    assert.equal(frontend.getNode("textSizeLarge").attributes["aria-pressed"], "true");
    frontend.getNode("textSizeExtraLarge").listeners.get("click")();
    assert.equal(frontend.getNode("body").classList.contains("text-size-extra-large"), true);
    const contrast = frontend.getNode("contrastToggle");
    contrast.checked = true;
    contrast.listeners.get("change")({ target: contrast });
    assert.equal(frontend.getNode("body").classList.contains("high-contrast"), true);
    const speed = frontend.getNode("speechSpeed");
    speed.value = "1.25";
    speed.listeners.get("change")({ target: speed });

    const restored = await loadFrontend({ sessionStore });
    assert.equal(restored.getNode("body").classList.contains("text-size-extra-large"), true);
    assert.equal(restored.getNode("body").classList.contains("high-contrast"), true);
    assert.equal(restored.getNode("speechSpeed").value, "1.25");
});

test("read-aloud speed applies to browser TTS and Sarvam audio, and repeat speaks the current step", async () => {
    const frontend = await loadFrontend({ fetchImpl: async () => ({ ok: true, blob: async () => ({ type: "audio/mpeg" }) }) });
    const speed = frontend.getNode("speechSpeed");
    speed.value = "1.5";
    speed.listeners.get("change")({ target: speed });
    frontend.context.speakText("English instruction");
    assert.equal(frontend.spoken.at(-1).rate, 1.5);

    frontend.nodes.get("language").value = "hi";
    const hindiPlayback = frontend.context.speakText("हिंदी निर्देश");
    await hindiPlayback;
    assert.equal(frontend.playedAudio.at(-1).playbackRate, 1.5);

    frontend.nodes.get("language").value = "en";
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    frontend.guide.querySelector("#visualSpeak").onclick();
    assert.match(frontend.spoken.at(-1).text, /yellow highlighted.*Open Documents.*Open Documents\./i);
    assert.equal(frontend.spoken.at(-1).rate, 1.5);
});

test("Hindi Read Aloud uses Sarvam audio and releases its object URL after playback", async () => {
    const frontend = await loadFrontend({ fetchImpl: async () => ({ ok: true, blob: async () => ({ type: "audio/mpeg" }) }) });
    frontend.nodes.get("language").value = "hi";
    const button = frontend.getNode("hindiSpeak");
    button.innerHTML = "🔊 सुनें";

    const playback = frontend.context.speakText("साइडबार में Documents खोलें।", button);
    assert.equal(button.disabled, true);
    assert.equal(button.attributes["aria-busy"], "true");
    await playback;

    const request = frontend.fetchCalls.find(call => call.url === "/api/speech/hindi");
    assert.ok(request);
    assert.deepEqual(JSON.parse(request.options.body), { text: "साइडबार में Documents खोलें।", languageCode: "hi-IN" });
    assert.equal(frontend.playedAudio.length, 1);
    assert.equal(frontend.spoken.length, 0);
    assert.equal(button.innerHTML, "⏳ ऑडियो बन रहा है…");

    frontend.playedAudio[0].onended();
    assert.deepEqual(frontend.revokedUrls, ["blob:raasta-1"]);
    assert.equal(button.disabled, false);
    assert.equal(button.attributes["aria-busy"], "false");
    assert.equal(button.innerHTML, "🔊 सुनें");
});

test("Hindi Sarvam failure falls back to browser Hindi TTS", async () => {
    const frontend = await loadFrontend({ fetchImpl: async () => ({ ok: false }) });
    frontend.nodes.get("language").value = "hi";
    await frontend.context.speakText("फीस रसीद खोलें।");
    assert.equal(frontend.spoken.at(-1).text, "फीस रसीद खोलें।");
    assert.equal(frontend.spoken.at(-1).lang, "hi-IN");
    assert.match(frontend.nodes.get("taskStatus").textContent, /ब्राउज़र की हिंदी आवाज़/);
});

test("Hindi audio playback failure also falls back to browser speech", async () => {
    const frontend = await loadFrontend({
        audioPlayFailure: true,
        fetchImpl: async () => ({ ok: true, blob: async () => ({ type: "audio/mpeg" }) })
    });
    frontend.nodes.get("language").value = "hi";
    await frontend.context.speakText("कृपया Documents खोलें।");
    assert.equal(frontend.spoken.at(-1).lang, "hi-IN");
    assert.deepEqual(frontend.revokedUrls, ["blob:raasta-1"]);
});

test("new Hindi playback cancels the prior request and guide navigation stops active audio", async () => {
    let calls = 0;
    const frontend = await loadFrontend({ fetchImpl: async (_url, { signal }) => {
        calls += 1;
        if (calls === 1) return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true }));
        return { ok: true, blob: async () => ({ type: "audio/mpeg" }) };
    } });
    frontend.nodes.get("language").value = "hi";
    const first = frontend.context.speakText("पहली आवाज़");
    await new Promise(resolve => setImmediate(resolve));
    const second = frontend.context.speakText("दूसरी आवाज़");
    await Promise.all([first, second]);
    assert.equal(calls, 2);
    assert.equal(frontend.playedAudio.length, 1, "aborted playback response is ignored");

    const firstAudio = frontend.playedAudio[0];
    frontend.nodes.get("language").value = "en";
    frontend.nodes.get("language").listeners.get("change")();
    assert.equal(firstAudio.paused, true, "language switch cancels current audio");
    assert.deepEqual(frontend.revokedUrls, ["blob:raasta-1"]);

    frontend.nodes.get("language").value = "hi";
    await frontend.context.speakText("अगली आवाज़");
    assert.equal(frontend.playedAudio.length, 2);

    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    const audio = frontend.playedAudio[1];
    frontend.guide.querySelector("#visualNext").onclick();
    assert.equal(audio.paused, true);
    assert.deepEqual(frontend.revokedUrls, ["blob:raasta-1", "blob:raasta-2"]);
});
