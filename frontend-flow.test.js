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
        listeners,
        classList: {
            add: value => classes.add(value),
            remove: value => classes.delete(value),
            contains: value => classes.has(value)
        },
        addEventListener: (name, handler) => listeners.set(name, handler),
        setAttribute(name, value) { this.attributes[name] = value; },
        focus() {},
        scrollIntoView() {}
    };
}

async function loadFrontend({ result = null } = {}) {
    const source = await readFile(new URL("./script.js", import.meta.url), "utf8");
    const nodes = new Map();
    const getNode = key => {
        if (!nodes.has(key)) nodes.set(key, makeElement());
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
                if (key.startsWith("guide:")) nodes.set(key, makeElement());
            }
        }
    });

    const voices = [{ lang: "en-IN" }, { lang: "hi-IN" }];
    const spoken = [];
    const speechSynthesis = {
        onvoiceschanged: null,
        getVoices: () => voices,
        cancel() {},
        speak: utterance => spoken.push(utterance)
    };
    let recognition;
    const fetchCalls = [];
    class FakeRecognition {
        constructor() { recognition = this; }
        start() { this.started = true; }
    }
    class FakeUtterance {
        constructor(text) { this.text = text; }
    }
    const document = {
        documentElement: getNode("html"),
        getElementById: getNode,
        querySelector: getNode,
        querySelectorAll: () => [],
        createElement: makeElement
    };
    const window = {
        speechSynthesis,
        SpeechRecognition: FakeRecognition,
        webkitSpeechRecognition: undefined
    };
    const context = vm.createContext({
        document,
        window,
        SpeechSynthesisUtterance: FakeUtterance,
        fetch: async (url, options) => {
            fetchCalls.push({ url, options });
            return { ok: true, json: async () => result };
        },
        alert() {},
        console: { log() {}, warn() {}, error() {} }
    });
    vm.runInContext(source, context);
    return { context, guide, nodes, voices, spoken, speechSynthesis, fetchCalls, get recognition() { return recognition; } };
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

test("visual guide navigation reveals the download control, completes safely, and restarts the same plan", async () => {
    const frontend = await loadFrontend();
    frontend.context.showGuide(guidePlan.task, guidePlan, 0);
    const query = selector => frontend.guide.querySelector(selector);
    const next = query("#visualNext");
    const previous = query("#visualPrevious");

    assert.equal(query("#visualInstruction").textContent, "Open Documents.");
    assert.equal(query("#portalDocuments").classList.contains("active-target"), true);
    query("#visualSpeak").onclick();
    assert.equal(frontend.spoken.at(-1).text, "Open Documents.");
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

    query("#portalDocuments").onclick();
    assert.equal(query("#visualInstruction").textContent, "Select Fee Receipts.");
    query("#portalReceipts").onclick();
    assert.equal(query("#receiptBox").classList.contains("receipt-visible"), true);
    query("#portalDownload").onclick();
    assert.match(query(".instruction-panel").innerHTML, /Demo complete!/);
    assert.match(query(".instruction-panel").innerHTML, /No real file was downloaded/);
});

test("mocked speech controls choose the selected recognition and synthesis languages", async () => {
    const frontend = await loadFrontend();
    const language = frontend.nodes.get("language");
    const voiceButton = frontend.nodes.get("voiceBtn");

    language.value = "en";
    voiceButton.listeners.get("click")();
    assert.equal(frontend.recognition.lang, "en-IN");
    assert.equal(frontend.recognition.started, true);
    frontend.recognition.onresult({ results: [[{ transcript: "Find my hostel receipt" }]] });
    assert.equal(frontend.nodes.get("taskInput").value, "Find my hostel receipt");
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
    frontend.recognition.onend();
    frontend.context.speakText("हॉस्टल फीस की रसीद");
    assert.equal(frontend.spoken.at(-1).lang, "hi-IN");
    language.value = "en";
    frontend.context.applyPageLanguage();
    assert.equal(frontend.nodes.get("html").lang, "en");
    frontend.context.speakText("Fee receipt");
    assert.equal(frontend.spoken.at(-1).lang, "en-IN");
});
