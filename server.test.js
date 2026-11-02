import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { Readable } from "node:stream";
import { createApp } from "./server.js";

const targets = ["portalDocuments", "portalReceipts", "portalDownload"];

function plan(category = "fee_receipt", overrides = {}) {
    return {
        task: "Download a college fee receipt",
        category,
        language: "en",
        instruction: "Open the fee receipt in the portal.",
        steps: category === "fee_receipt" ? targets.map((targetElementId, index) => ({
            instruction: `Step ${index + 1}`,
            targetElementId
        })) : [],
        clarifyingQuestion: category === "unsupported" ? "Which fee receipt do you mean?" : "",
        ...overrides
    };
}

const NEVER_RESOLVE = Symbol("never-resolve");
const TEST_SARVAM_KEY = "synthetic-sarvam-test-key";

async function startTestServer({
    apiKey = "test-key", model = "test-flash", response, failure, outcomes,
    delayMs = 0, deadlineMs = 15_000, retryDelayMs = 250, logger, liveGemini = false,
    fetchImpl, sarvamTimeoutMs
} = {}) {
    const calls = [];
    const callOptions = [];
    let clientCreated = false;
    const appLogger = logger || { info() {}, error() {} };
    const appOptions = {
        apiKey,
        model,
        geminiDeadlineMs: deadlineMs,
        retryDelayMs,
        logger: appLogger
    };
    if (fetchImpl) appOptions.fetchImpl = fetchImpl;
    if (sarvamTimeoutMs !== undefined) appOptions.sarvamTimeoutMs = sarvamTimeoutMs;
    if (!liveGemini) {
        appOptions.createGeminiClient = options => {
            clientCreated = true;
            assert.equal(options.apiKey, apiKey);
            return {
                interactions: {
                    async create(payload, options) {
                        calls.push(payload);
                        callOptions.push(options);
                        if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
                        const next = outcomes?.length
                            ? outcomes.shift()
                            : (failure || (typeof response === "function" ? response(payload) : response));
                        if (next === NEVER_RESOLVE) return new Promise(() => {});
                        if (typeof next === "function") return next(payload, options);
                        if (next instanceof Error) throw next;
                        return next && typeof next === "object" && "output_text" in next
                            ? next
                            : { output_text: next };
                    }
                }
            };
        };
    }
    const app = createApp(appOptions);
    function request(method, url, body) {
        return new Promise((resolve, reject) => {
            const bodyText = body === undefined ? "" : JSON.stringify(body);
            const request = Readable.from(bodyText ? [Buffer.from(bodyText)] : []);
            Object.assign(request, {
                method,
                url,
                originalUrl: url,
                headers: bodyText ? {
                    "content-type": "application/json",
                    "content-length": Buffer.byteLength(bodyText)
                } : {},
                httpVersion: "1.1",
                socket: { remoteAddress: "127.0.0.1" }
            });
            request.connection = request.socket;

            const response = Object.create(app.response);
            const headers = new Map();
            const listeners = new Map();
            Object.assign(response, {
                app,
                req: request,
                locals: {},
                statusCode: 200,
                setHeader(name, value) { headers.set(name.toLowerCase(), value); return this; },
                getHeader(name) { return headers.get(name.toLowerCase()); },
                removeHeader(name) { headers.delete(name.toLowerCase()); },
                on(event, listener) { listeners.set(event, listener); return this; },
                once(event, listener) { listeners.set(event, listener); return this; },
                emit(event, ...args) { listeners.get(event)?.(...args); return true; },
                sendFile(file) {
                    readFile(file).then(content => this.end(content)).catch(reject);
                    return this;
                },
                end(chunk = "") {
                    this.body = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
                    this._header ||= `HTTP/1.1 ${this.statusCode} Test\r\n`;
                    queueMicrotask(() => {
                        this.emit("finish");
                        resolve({
                            status: this.statusCode,
                            headers,
                            body: this.body,
                            json: async () => JSON.parse(this.body)
                        });
                    });
                    return this;
                }
            });
            request.res = response;
            app.handle(request, response, reject);
        });
    }
    return {
        calls,
        callOptions,
        get clientCreated() { return clientCreated; },
        close: async () => {},
        request: path => request("GET", path),
        postTask: (task, language = "en", options = {}) => request("POST", "/api/understand-task", { task, language, ...options }),
        post: (url, body) => request("POST", url, body)
    };
}

async function withSarvamKey(key, callback) {
    const previous = process.env.SARVAM_API_KEY;
    if (key === null) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = key;
    try {
        return await callback();
    } finally {
        if (previous === undefined) delete process.env.SARVAM_API_KEY;
        else process.env.SARVAM_API_KEY = previous;
    }
}

test("AI false-negative on the reported hostel request uses the known safe guide", async t => {
    const server = await startTestServer({ response: JSON.stringify(plan("unsupported")) });
    t.after(server.close);

    const response = await server.postTask(
        "I have already paid my college fees. Help me locate and download my hostel fee receipt."
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.supported, true);
    assert.equal(body.mode, "ai");
    assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
});

test("AI-supported college tuition and semester requests retain validated generated instructions", async t => {
    const server = await startTestServer({ response: JSON.stringify(plan("fee_receipt", {
        task: "Tuition and semester fee receipts",
        steps: targets.map((targetElementId, index) => ({ instruction: `Validated step ${index + 1}`, targetElementId }))
    })) });
    t.after(server.close);

    const response = await server.postTask("Download my tuition and semester fee receipt.");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.supported, true);
    assert.equal(body.steps[0].instruction, "Validated step 1");
    assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
});

test("Hindi hostel request recovers from Gemini false-negative with Hindi instructions", async t => {
    const server = await startTestServer({ response: JSON.stringify(plan("unsupported")) });
    t.after(server.close);

    const response = await server.postTask("कॉलेज की फीस जमा है, हॉस्टल फीस की रसीद डाउनलोड करनी है।", "hi");
    const body = await response.json();
    assert.equal(body.supported, true);
    assert.equal(body.language, "hi");
    assert.match(body.steps[0].instruction, /दस्तावेज़/);
    assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
});

test("Hinglish hostel request recovers from Gemini false-negative", async t => {
    const server = await startTestServer({ response: JSON.stringify(plan("unsupported")) });
    t.after(server.close);

    const response = await server.postTask("Maine college fees pay kar di, hostel fee receipt download karni hai.", "hi");
    const body = await response.json();
    assert.equal(body.supported, true);
    assert.equal(body.language, "hi");
    assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
});

test("local fallback opens the safe guide for fee, hostel, and semester receipt speech variants", async t => {
    const server = await startTestServer({ apiKey: null });
    t.after(server.close);

    const requests = [
        "Mujhe free receipt download karni hai.",
        "Maine hostel ki fees bhar di, receipt chahiye.",
        "Hostel fee ka proof download karna hai.",
        "College fees ki rasid chahiye.",
        "Mujhe semester fees ki receipt chahiye.",
        "मुझे हॉस्टल की फीस की रसीद डाउनलोड करनी है।"
    ];
    for (const task of requests) {
        const response = await server.postTask(task, /[\u0900-\u097F]/u.test(task) ? "hi" : "en");
        const body = await response.json();
        assert.equal(body.supported, true, task);
        assert.equal(body.task, task, "the transcript remains unchanged for display");
        assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
    }
});

test("Gemini receives the contextual correction once while the response retains the original transcript", async t => {
    const server = await startTestServer({ response: JSON.stringify(plan("unsupported")) });
    t.after(server.close);

    const original = "Mujhe free receipt download karni hai.";
    const response = await server.postTask(original);
    const body = await response.json();
    assert.equal(server.calls.length, 1);
    assert.match(server.calls[0].input, /Mujhe fee receipt download karni hai/);
    assert.doesNotMatch(server.calls[0].input, /Mujhe free receipt download karni hai/);
    assert.equal(body.supported, true);
    assert.equal(body.task, original);
});

test("unrelated receipts remain unsupported even if Gemini proposes the supported workflow", async t => {
    const server = await startTestServer({ response: JSON.stringify(plan()) });
    t.after(server.close);

    for (const task of ["Find my train ticket receipt.", "Download the electricity bill receipt.", "I need a shopping receipt."]) {
        const response = await server.postTask(task);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.supported, false, task);
        assert.deepEqual(body.steps, [], task);
    }
});

test("ambiguous requests preserve Gemini clarification", async t => {
    const server = await startTestServer({ response: JSON.stringify(plan("unsupported")) });
    t.after(server.close);

    const response = await server.postTask("Please help me find my receipt.");
    const body = await response.json();
    assert.equal(body.supported, false);
    assert.equal(body.clarifyingQuestion, "Which fee receipt do you mean?");
    assert.deepEqual(body.steps, []);
});

test("malformed Gemini JSON returns a controlled 502 error", async t => {
    const server = await startTestServer({ response: "{not valid JSON" });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /invalid response from Gemini/i);
});

test("invalid Gemini target IDs are rejected and never returned", async t => {
    const invalidPlan = plan("fee_receipt", {
        steps: ["portalDocuments", "inventedTarget", "portalDownload"].map(targetElementId => ({
            instruction: "Open this item",
            targetElementId
        }))
    });
    const server = await startTestServer({ response: JSON.stringify(invalidPlan) });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    const body = await response.json();
    assert.equal(body.supported, false);
    assert.deepEqual(body.steps, []);
    assert.equal(JSON.stringify(body).includes("inventedTarget"), false);
});

test("HTTP 503 retries once and accepts a successful Gemini response", async t => {
    const logs = [];
    const logger = { info: message => logs.push(message), warn: message => logs.push(message), error() {} };
    const serviceUnavailable = Object.assign(new Error("temporary service unavailable"), { status: 503 });
    const server = await startTestServer({
        outcomes: [serviceUnavailable, { output_text: JSON.stringify(plan()) }],
        retryDelayMs: 5,
        logger
    });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.supported, true);
    assert.equal(body.mode, "ai");
    assert.equal(server.calls.length, 2);
    assert.equal(server.callOptions[0].retries.strategy, "none");
    assert.ok(server.callOptions[0].timeout_ms <= 15_000 && server.callOptions[0].timeout_ms > 14_900);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(logs.some(line => line.includes("attempt=1 failed name=Error status=503 message=temporary service unavailable")));
    assert.ok(logs.some(line => line.includes("retry=1 scheduled after 5ms")));
    assert.ok(logs.some(line => line.includes("retries=1 fallback=false")));
});

test("HTTP 429 daily free-tier quota exhaustion does not retry", async t => {
    const quotaError = Object.assign(new Error("Rate limit exceeded for model gemini-3.8-flash. Free Tier limit: 20 requests per day."), {
        name: "RateLimitError",
        status: 429
    });
    const server = await startTestServer({ failure: quotaError, retryDelayMs: 5 });
    t.after(server.close);

    const startedAt = performance.now();
    const response = await server.postTask("Download my college fee receipt.");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "fallback");
    assert.match(body.message, /free-tier daily quota has been reached/i);
    assert.ok(performance.now() - startedAt < 500, "quota fallback should return without waiting for a retry");
    assert.doesNotMatch(JSON.stringify(body), /rate limit exceeded|gemini-3\.8-flash|HTTP 429/i);
    assert.equal(server.calls.length, 1);
});

test("HTTP 429 temporary rate limit can retry once", async t => {
    const temporaryRateLimit = Object.assign(new Error("Too many requests. Please retry shortly."), {
        name: "RateLimitError",
        status: 429
    });
    const server = await startTestServer({
        outcomes: [temporaryRateLimit, { output_text: JSON.stringify(plan()) }],
        retryDelayMs: 5
    });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "ai");
    assert.equal(body.supported, true);
    assert.equal(server.calls.length, 2);
});

test("daily quota exhaustion returns the safe local guide with allowlisted targets", async t => {
    const quotaError = Object.assign(new Error("Daily request quota exhausted"), { status: 429 });
    const server = await startTestServer({ failure: quotaError });
    t.after(server.close);

    const response = await server.postTask("Download my hostel fee receipt.");
    const body = await response.json();
    assert.equal(body.mode, "fallback");
    assert.equal(body.supported, true);
    assert.match(body.message, /continuing in local mode/i);
    assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
    assert.equal(server.calls.length, 1);
});

test("unsupported task after quota exhaustion keeps clarification and no portal targets", async t => {
    const quotaError = Object.assign(new Error("Daily request quota exhausted"), { status: 429 });
    const server = await startTestServer({ failure: quotaError });
    t.after(server.close);

    const response = await server.postTask("Find my train ticket receipt.");
    const body = await response.json();
    assert.equal(body.mode, "fallback");
    assert.equal(body.supported, false);
    assert.match(body.message, /free-tier daily quota has been reached/i);
    assert.match(body.clarifyingQuestion, /currently guides college, hostel, tuition, and semester fee receipts/i);
    assert.deepEqual(body.steps, []);
    assert.equal(server.calls.length, 1);
});

test("HTTP 429 with a future quota reset time does not retry", async t => {
    const quotaError = Object.assign(new Error("Rate limit exceeded"), {
        name: "RateLimitError",
        status: 429,
        details: [{ quotaResetTime: new Date(Date.now() + 60_000).toISOString() }]
    });
    const server = await startTestServer({ failure: quotaError, retryDelayMs: 5 });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    assert.equal((await response.json()).mode, "fallback");
    assert.equal(server.calls.length, 1);
});

test("persistent HTTP 503 returns the safe local guide and logs fallback", async t => {
    const logs = [];
    const logger = { info: message => logs.push(message), warn: message => logs.push(message), error() {} };
    const serviceUnavailable = Object.assign(new Error("temporary service unavailable"), { status: 503 });
    const server = await startTestServer({
        outcomes: [serviceUnavailable, serviceUnavailable],
        retryDelayMs: 5,
        logger
    });
    t.after(server.close);

    const response = await server.postTask("Download my hostel fee receipt.");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "fallback");
    assert.equal(body.supported, true);
    assert.match(body.message, /temporarily unavailable/i);
    assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(logs.some(line => line.includes("retries=1 fallback=true")));
});

test("HTTP 500 is treated as temporary and uses the safe local guide", async t => {
    const internalError = Object.assign(new Error("temporary internal error"), { status: 500 });
    const server = await startTestServer({ failure: internalError, retryDelayMs: 5 });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "fallback");
    assert.equal(body.supported, true);
    assert.equal(server.calls.length, 2);
});

test("overall deadline aborts a stalled Gemini operation and returns fallback quickly", async t => {
    const server = await startTestServer({ deadlineMs: 60, outcomes: [NEVER_RESOLVE] });
    t.after(server.close);
    const startedAt = performance.now();

    const response = await server.postTask("Download my college fee receipt.");
    const body = await response.json();
    assert.ok(performance.now() - startedAt < 500, "deadline should be enforced independently of the SDK promise");
    assert.equal(response.status, 200);
    assert.equal(body.mode, "fallback");
    assert.equal(body.supported, true);
    assert.equal(server.callOptions[0].signal.aborted, true);
});

test("deadline diagnostic records the SDK error after abort without leaking key-like data", async t => {
    const logs = [];
    const apiKey = "AIzaSyExampleSecret12345678901234567890";
    const abortFailure = (_payload, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
            const error = Object.assign(new Error(`request failed with ${apiKey}; authorization: Bearer hidden-token`), {
                name: "APIConnectionError",
                cause: Object.assign(new Error("upstream unavailable"), { status: 503 })
            });
            reject(error);
        }, { once: true });
    });
    const server = await startTestServer({
        apiKey,
        deadlineMs: 40,
        outcomes: [abortFailure],
        logger: { info: message => logs.push(message), warn: message => logs.push(message), error: message => logs.push(message) }
    });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    assert.equal((await response.json()).mode, "fallback");
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(logs.some(line => line.includes("overall deadline exceeded after 40ms")));
    assert.ok(logs.some(line => line.includes("name=APIConnectionError status=503")));
    assert.ok(logs.every(line => !line.includes(apiKey) && !line.includes("hidden-token")));
});

test("network failures retry once and then use local intent fallback", async t => {
    const networkError = new Error("network unavailable");
    networkError.name = "APIConnectionError";
    networkError.cause = Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" });
    const server = await startTestServer({ outcomes: [networkError, networkError], retryDelayMs: 5 });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "fallback");
    assert.equal(body.supported, true);
    assert.equal(server.calls.length, 2);
});

test("invalid API keys return clear configuration guidance without local fallback", async t => {
    const invalidKey = Object.assign(new Error("invalid key"), { status: 401 });
    const server = await startTestServer({ failure: invalidKey });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.match(body.error, /configuration was rejected/i);
    assert.equal(body.supported, undefined);
    assert.equal(server.calls.length, 1);
});

test("temporary errors use the local classifier in Hindi and preserve a useful message", async t => {
    const timeout = Object.assign(new Error("request timed out"), { name: "TimeoutError" });
    const server = await startTestServer({ failure: timeout, retryDelayMs: 5 });
    t.after(server.close);

    const response = await server.postTask("हॉस्टल फीस की रसीद चाहिए।", "hi");
    const body = await response.json();
    assert.equal(body.mode, "fallback");
    assert.equal(body.language, "hi");
    assert.match(body.message, /Gemini अभी उपलब्ध नहीं है/);
    assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
});

test("missing API key uses demo mode without creating a Gemini client", async t => {
    const server = await startTestServer({ apiKey: "", response: JSON.stringify(plan()) });
    t.after(server.close);

    const health = await (await server.request("/api/health")).json();
    const response = await server.postTask("Download my hostel fee receipt.");
    const body = await response.json();
    assert.deepEqual(health, { ok: true, mode: "demo" });
    assert.equal(body.supported, true);
    assert.equal(body.mode, "demo");
    assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
    assert.equal(server.clientCreated, false);
});

test("local clarification asks which fee for generic payment proof and phone basics opens its tutorial picker", async t => {
    const server = await startTestServer({ apiKey: "" });
    t.after(server.close);

    const ambiguous = await (await server.postTask("My money was deducted but I cannot find the receipt.")).json();
    const unrelated = await (await server.postTask("Find my train ticket receipt.")).json();
    const hindi = await (await server.postTask("पैसे कट गए हैं लेकिन भुगतान की रसीद नहीं मिल रही।", "hi")).json();
    const hinglish = await (await server.postTask("Fees jama ho gayi hai, ab receipt kaise nikalu?")).json();
    const otherWorkflow = await (await server.postTask("I want to learn how to use my phone.")).json();

    assert.equal(ambiguous.supported, false);
    assert.match(ambiguous.clarifyingQuestion, /Which fee did you pay—hostel, tuition, semester/i);
    assert.equal(unrelated.supported, false);
    assert.match(unrelated.clarifyingQuestion, /Raasta currently guides college, hostel, tuition, and semester fee receipts/i);
    assert.equal(hindi.supported, false);
    assert.match(hindi.clarifyingQuestion, /आपने कौन-सी फीस भरी थी/);
    assert.equal(hinglish.supported, false);
    assert.match(hinglish.clarifyingQuestion, /Aapne kaunsi fees pay ki thi/);
    assert.equal(otherWorkflow.supported, true);
    assert.equal(otherWorkflow.category, "smartphone_basics");
    assert.equal(otherWorkflow.topic, null);
    assert.equal(otherWorkflow.steps[0].targetElementId, "phoneTutorialChoice");
    for (const plan of [ambiguous, unrelated, hindi, hinglish]) assert.deepEqual(plan.steps, []);
});

test("all eight demo-readiness prompts make safe local decisions without calling Gemini", async t => {
    const server = await startTestServer({ apiKey: "" });
    t.after(server.close);
    const cases = [
        { task: "Hostel fees bhar di, receipt kahan milegi?", supported: true },
        { task: "Paise kat gaye lekin payment ka proof nahi mil raha.", question: /Aapne kaunsi fees pay ki thi/i },
        { task: "Maine semester fees jama kar di hai, ab receipt kaise download karun?", supported: true },
        { task: "I paid my tuition fees. Where can I find the receipt?", supported: true },
        { task: "मुझे हॉस्टल की फीस की रसीद डाउनलोड करनी है।", language: "hi", supported: true },
        { task: "My money was deducted but I cannot find my payment confirmation.", question: /Which fee did you pay/i },
        { task: "Mujhe apna exam result check karna hai.", supported: true, universal: true },
        { task: "College portal pe password kaise change karun?", supported: true, universal: true }
    ];

    for (const item of cases) {
        const response = await server.postTask(item.task, item.language || "en");
        const body = await response.json();
        assert.equal(response.status, 200, item.task);
        assert.equal(body.supported, Boolean(item.supported), item.task);
        if (item.supported) {
            assert.equal(body.mode, "demo", item.task);
            if (item.universal) {
                assert.equal(body.category, "universal_guidance", item.task);
                assert.ok(body.steps.length >= 2, item.task);
                assert.ok(body.steps.every(step => !Object.hasOwn(step, "targetElementId")), item.task);
            } else assert.deepEqual(body.steps.map(step => step.targetElementId), targets, item.task);
        } else {
            assert.match(body.clarifyingQuestion, item.question, item.task);
            assert.deepEqual(body.steps, [], item.task);
        }
    }
    assert.equal(server.clientCreated, false);
    assert.equal(server.calls.length, 0);
});

test("local demo mode returns safe plans for train, document, and smartphone requests in all input styles", async t => {
    const server = await startTestServer({ apiKey: "" });
    t.after(server.close);
    const scenarios = [
        { task: "I want to book a train ticket.", category: "train_booking", language: "en", expectedTargets: ["trainSource", "trainDestination", "trainDate", "trainSearch", "trainSelect", "trainPassenger", "trainReview", "bookingConfirm"] },
        { task: "Mujhe Jaipur se Delhi ki train book karni hai.", category: "train_booking", language: "hi", source: "Jaipur", destination: "Delhi" },
        { task: "How can I find trains between two cities?", category: "train_booking", language: "en" },
        { task: "I want to download my bonafide certificate.", category: "document_download", language: "en", documentType: "bonafide" },
        { task: "Mujhe apna document download karna hai.", category: "document_download", language: "hi", documentType: null },
        { task: "How do I download my marksheet?", category: "document_download", language: "en", documentType: "marksheet" },
        { task: "Teach me how to connect to Wi-Fi.", category: "smartphone_basics", language: "en", topic: "wifi" },
        { task: "Mujhe Wi-Fi connect karna sikhao.", category: "smartphone_basics", language: "hi", topic: "wifi" },
        { task: "How do I increase my phone brightness?", category: "smartphone_basics", language: "en", topic: "brightness" },
        { task: "How do I turn on Bluetooth?", category: "smartphone_basics", language: "en", topic: "bluetooth" },
        { task: "Turn Bluetooth off.", category: "smartphone_basics", language: "en", topic: "bluetooth" },
        { task: "Mujhe Bluetooth on karna hai.", category: "smartphone_basics", language: "hi", topic: "bluetooth" },
        { task: "Bluetooth chalu karo.", category: "smartphone_basics", language: "hi", topic: "bluetooth" },
        { task: "Bluetooth band karna hai.", category: "smartphone_basics", language: "hi", topic: "bluetooth" },
        { task: "मुझे Bluetooth चालू करना है।", category: "smartphone_basics", language: "hi", topic: "bluetooth" },
        { task: "Teach me how to use my smartphone.", category: "smartphone_basics", language: "en", topic: null }
    ];
    for (const scenario of scenarios) {
        const body = await (await server.postTask(scenario.task, scenario.language)).json();
        assert.equal(body.supported, true, scenario.task);
        assert.equal(body.category, scenario.category, scenario.task);
        assert.equal(body.mode, "demo", scenario.task);
        if (scenario.topic !== undefined) assert.equal(body.topic, scenario.topic, scenario.task);
        if (scenario.documentType !== undefined) assert.equal(body.documentType, scenario.documentType, scenario.task);
        if (scenario.source) assert.equal(body.source, scenario.source, scenario.task);
        if (scenario.destination) assert.equal(body.destination, scenario.destination, scenario.task);
        if (scenario.expectedTargets) assert.deepEqual(body.steps.map(step => step.targetElementId), scenario.expectedTargets);
        assert.ok(body.steps.length > 0, scenario.task);
    }
    assert.equal(server.clientCreated, false);
    assert.equal(server.calls.length, 0);
});

test("explicit Demo Mode uses the local classifier for all four workflows without creating a Gemini client", async t => {
    const server = await startTestServer({ apiKey: "configured-test-key", response: new Error("Gemini must not be called in Demo Mode") });
    t.after(server.close);
    const cases = [
        { task: "I want to download my fee receipt.", language: "en", category: "fee_receipt", target: "portalDocuments" },
        { task: "Mujhe Jaipur se Delhi ki train book karni hai.", language: "hi", category: "train_booking", target: "trainSource" },
        { task: "I want to download my bonafide certificate.", language: "en", category: "document_download", target: "documentOpen" },
        { task: "Mujhe Bluetooth on karna hai.", language: "hi", category: "smartphone_basics", target: "phoneSettings" },
        { task: "मुझे हॉस्टल की फीस की रसीद डाउनलोड करनी है।", language: "hi", category: "fee_receipt", target: "portalDocuments" }
    ];

    for (const item of cases) {
        const response = await server.postTask(item.task, item.language, { demoMode: true });
        const body = await response.json();
        assert.equal(response.status, 200, item.task);
        assert.equal(body.mode, "demo", item.task);
        assert.equal(body.supported, true, item.task);
        assert.equal(body.category, item.category, item.task);
        assert.equal(body.steps[0].targetElementId, item.target, item.task);
        assert.ok(body.steps.length > 0, item.task);
    }
    assert.equal(server.clientCreated, false);
    assert.equal(server.calls.length, 0);
});

test("Demo Mode creates target-free universal guides for common digital tasks in English and Hinglish", async t => {
    const server = await startTestServer({ apiKey: "configured-test-key", response: new Error("Gemini must not be called in Demo Mode") });
    t.after(server.close);
    const cases = [
        ["I want to turn on my PS5.", "en", /power-marked button/i],
        ["Mera PS5 chalu kaise karu?", "hi", /power निशान/i],
        ["Mujhe PS 5 chalu karna hai.", "hi", /power निशान/i],
        ["Connect my PS5 controller.", "en", /PS button/i],
        ["I want to connect my phone to Bluetooth headphones.", "en", /pairing mode/i],
        ["Connect Bluetooth headphones to my laptop.", "en", /Windows.*Mac/],
        ["Mujhe laptop par Bluetooth headphones connect karne hain.", "hi", /Windows.*Mac/],
        ["Connect bluetooh headphones to my laptop.", "en", /Windows.*Mac/],
        ["How do I connect my laptop to a TV?", "en", /Input\/Source/],
        ["Turn on my TV.", "en", /working outlet/i],
        ["How do I switch on my television?", "en", /physical button/i],
        ["Mujhe TV chalu karni hai.", "hi", /Power निशान/],
        ["muje tv chalu karni hai", "hi", /Power निशान/],
        ["TV on kaise karu?", "hi", /एक बार दबाएँ/],
        ["टीवी चालू करनी है।", "hi", /काम कर रहे socket/],
        ["How do I turn off my TV?", "en", /standby/i],
        ["TV band karni hai.", "hi", /standby light/i],
        ["How do I change the HDMI input?", "en", /Input\/Source/],
        ["Connect my phone to my TV.", "en", /Not every phone/],
        ["How do I take a screenshot on Windows?", "en", /Windows\+Shift\+S/i],
        ["Mujhe apne phone ka hotspot on karna hai.", "hi", /Hotspot चालू/i],
        ["Turn on my phone hotspot.", "en", /Personal Hotspot/i],
        ["How do I connect my laptop to Wi-Fi?", "en", /network/i]
    ];
    for (const [task, language, expected] of cases) {
        const body = await (await server.postTask(task, language, { demoMode: true })).json();
        assert.equal(body.supported, true, task);
        assert.equal(body.category, "universal_guidance", task);
        assert.equal(body.mode, "demo", task);
        assert.ok(body.steps.length >= 2 && body.steps.length <= 8, task);
        assert.ok(body.steps.some(step => expected.test(step.instruction)), task);
        assert.ok(body.steps.every(step => !Object.hasOwn(step, "targetElementId")), task);
    }
    assert.equal(server.calls.length, 0);
    assert.equal(server.clientCreated, false);
});

test("TV local guides work without Gemini and after quota exhaustion", async t => {
    const demoServer = await startTestServer({ apiKey: "configured-test-key", failure: new Error("Gemini must not be called") });
    t.after(demoServer.close);
    const demo = await (await demoServer.postTask("Turn on my TV.", "en", { demoMode: true })).json();
    assert.equal(demo.supported, true);
    assert.equal(demo.mode, "demo");
    assert.equal(demo.category, "universal_guidance");
    assert.equal(demoServer.calls.length, 0);

    const noKeyServer = await startTestServer({ apiKey: "" });
    t.after(noKeyServer.close);
    const noKey = await (await noKeyServer.postTask("Mujhe TV chalu karni hai.", "hi")).json();
    assert.equal(noKey.supported, true);
    assert.equal(noKey.mode, "demo");
    assert.match(noKey.steps[1].instruction, /remote|physical/i);
    assert.equal(noKeyServer.clientCreated, false);

    const quotaServer = await startTestServer({ failure: Object.assign(new Error("daily quota exhausted"), { status: 429 }) });
    t.after(quotaServer.close);
    const fallback = await (await quotaServer.postTask("How do I change the HDMI input?", "en")).json();
    assert.equal(fallback.supported, true);
    assert.equal(fallback.mode, "fallback");
    assert.equal(fallback.category, "universal_guidance");
    assert.ok(fallback.steps.some(step => /Input\/Source/i.test(step.instruction)));
    assert.ok(fallback.steps.every(step => !Object.hasOwn(step, "targetElementId")));
    assert.equal(quotaServer.calls.length, 1, "daily quota exhaustion is not retried");
});

test("universal Gemini output is validated, target-free and remains separate from specialized workflow targets", async t => {
    const universal = {
        task: "How do I turn on my PS5?", category: "universal_guidance", language: "en",
        instruction: "General guidance for powering on a PS5.", steps: [
            { title: "Check power", instruction: "Check that the console is connected to power." },
            { title: "Find the button", instruction: "Look for the power-marked button along the front edge; position varies by model." }
        ], clarifyingQuestion: "", device: "PlayStation 5"
    };
    const server = await startTestServer({ response: JSON.stringify(universal) });
    t.after(server.close);
    const body = await (await server.postTask(universal.task, "en")).json();
    assert.equal(body.supported, true);
    assert.equal(body.category, "universal_guidance");
    assert.equal(body.mode, "ai");
    assert.deepEqual(body.steps.map(step => step.title), ["Check power", "Find the button"]);
    assert.ok(body.steps.every(step => !Object.hasOwn(step, "targetElementId")));
    assert.equal(server.calls.length, 1);
    assert.deepEqual(server.calls[0].response_format.schema.properties.category.enum.includes("universal_guidance"), true);

    const maliciousServer = await startTestServer({ response: JSON.stringify({ ...universal, steps: universal.steps.map(step => ({ ...step, targetElementId: "madeUpControl" })) }) });
    t.after(maliciousServer.close);
    const rejected = await (await maliciousServer.postTask(universal.task, "en")).json();
    assert.equal(rejected.supported, false);
    assert.deepEqual(rejected.steps, []);
});

test("Gemini can generate general guidance for a digital task without a local canned guide", async t => {
    const task = "How do I turn off email notifications in my browser?";
    const response = {
        task, category: "universal_guidance", language: "en", instruction: "General browser guidance; menu labels vary.",
        steps: [
            { title: "Open browser settings", instruction: "Open the browser settings menu." },
            { title: "Find notification permissions", instruction: "Search settings for site notifications and review which sites can send them." },
            { title: "Change only the needed site", instruction: "Turn off notifications for the selected site, then verify the change." }
        ], clarifyingQuestion: "", device: "browser"
    };
    const server = await startTestServer({ response: JSON.stringify(response) });
    t.after(server.close);
    const body = await (await server.postTask(task, "en")).json();
    assert.equal(body.supported, true);
    assert.equal(body.category, "universal_guidance");
    assert.equal(body.mode, "ai");
    assert.equal(body.device, "browser");
    assert.equal(body.steps.length, 3);
    assert.ok(body.steps.every(step => !Object.hasOwn(step, "targetElementId")));
});

test("Gemini failures use known universal local guides and clarify platform-dependent requests", async t => {
    const server = await startTestServer({ apiKey: "configured-test-key", failure: Object.assign(new Error("service unavailable"), { status: 503 }), retryDelayMs: 2 });
    t.after(server.close);
    const guide = await (await server.postTask("I want to turn on my PS5.", "en")).json();
    assert.equal(guide.supported, true);
    assert.equal(guide.category, "universal_guidance");
    assert.equal(guide.mode, "fallback");
    assert.match(guide.message, /safe local guide/i);
    assert.ok(guide.steps.every(step => !Object.hasOwn(step, "targetElementId")));
    const clarification = await (await server.postTask("How do I turn on location services?", "en")).json();
    assert.equal(clarification.supported, false);
    assert.match(clarification.clarifyingQuestion, /which device and system/i);
});

test("universal guides remain useful after quota exhaustion and deadline expiry, while unknown tasks clarify", async t => {
    const quota = Object.assign(new Error("daily quota exhausted"), { status: 429 });
    const quotaServer = await startTestServer({ failure: quota, retryDelayMs: 2 });
    t.after(quotaServer.close);
    const quotaGuide = await (await quotaServer.postTask("Connect my PS5 controller.", "en")).json();
    assert.equal(quotaGuide.supported, true);
    assert.equal(quotaGuide.mode, "fallback");
    assert.equal(quotaGuide.category, "universal_guidance");
    assert.match(quotaGuide.message, /quota/i);
    assert.ok(quotaGuide.steps.every(step => !Object.hasOwn(step, "targetElementId")));
    assert.equal(quotaServer.calls.length, 1, "daily quota exhaustion is not retried");

    const timeoutServer = await startTestServer({ response: NEVER_RESOLVE, deadlineMs: 25 });
    t.after(timeoutServer.close);
    const timeoutGuide = await (await timeoutServer.postTask("Connect Bluetooth headphones to my laptop.", "en")).json();
    assert.equal(timeoutGuide.supported, true);
    assert.equal(timeoutGuide.mode, "fallback");
    assert.equal(timeoutGuide.category, "universal_guidance");
    assert.ok(timeoutGuide.steps.some(step => /Windows.*Mac/.test(step.instruction)));

    const unknown = await (await timeoutServer.postTask("How do I change my laptop notification settings?", "en")).json();
    assert.equal(unknown.supported, false);
    assert.deepEqual(unknown.steps, []);
    assert.ok(unknown.clarifyingQuestion?.trim(), "unknown device-specific tasks should receive a useful clarification");
});

test("a Gemini unsupported classification cannot override a known safe universal fallback", async t => {
    const server = await startTestServer({ response: JSON.stringify({ ...plan("unsupported"), clarifyingQuestion: "Which feature do you mean?" }) });
    t.after(server.close);
    const body = await (await server.postTask("I want to turn on my PS5.", "en")).json();
    assert.equal(body.supported, true);
    assert.equal(body.category, "universal_guidance");
    assert.equal(body.mode, "fallback");
    assert.match(body.message, /Gemini did not recognize this task/i);
    assert.ok(body.steps.every(step => !Object.hasOwn(step, "targetElementId")));
});

test("Gemini general guidance remains target-free and adds caution for security changes", async t => {
    const response = {
        task: "How do I change my Wi-Fi password?", category: "universal_guidance", language: "en",
        instruction: "Change the password in your router settings.",
        steps: [
            { title: "Open router settings", instruction: "Open the router’s official settings app or instructions." },
            { title: "Choose a password", instruction: "Use a strong unique password." }
        ], clarifyingQuestion: "", device: "router"
    };
    const server = await startTestServer({ response: JSON.stringify(response) });
    t.after(server.close);
    const body = await (await server.postTask(response.task, "en")).json();
    assert.equal(body.supported, true);
    assert.equal(body.category, "universal_guidance");
    assert.match(body.steps[0].instruction, /may affect .*security/i);
    assert.ok(body.steps.every(step => !Object.hasOwn(step, "targetElementId")));
});

test("explicit Demo Mode keeps ambiguity and unsupported tasks out of the workflow allowlist", async t => {
    const server = await startTestServer({ apiKey: "configured-test-key", response: new Error("Gemini must not be called in Demo Mode") });
    t.after(server.close);

    const ambiguous = await (await server.postTask("My money was deducted but I cannot find the receipt.", "en", { demoMode: true })).json();
    const unsupported = await (await server.postTask("Find my shopping receipt.", "en", { demoMode: true })).json();
    assert.equal(ambiguous.mode, "demo");
    assert.equal(ambiguous.supported, false);
    assert.match(ambiguous.clarifyingQuestion, /Which fee did you pay/i);
    assert.deepEqual(ambiguous.steps, []);
    assert.equal(unsupported.supported, false);
    assert.deepEqual(unsupported.steps, []);
    assert.equal(server.clientCreated, false);
    assert.equal(server.calls.length, 0);
});

test("deactivating explicit Demo Mode returns task understanding to the configured AI path", async t => {
    const server = await startTestServer({ response: JSON.stringify(plan("fee_receipt")) });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.", "en", { demoMode: false });
    const body = await response.json();
    assert.equal(body.mode, "ai");
    assert.equal(body.supported, true);
    assert.equal(server.calls.length, 1);
});

test("ambiguous and unsupported workflow requests ask clarification or stay outside the allowlist", async t => {
    const server = await startTestServer({ apiKey: "" });
    t.after(server.close);
    const cases = [
        { task: "Which document should I get?", question: /which document/i },
        { task: "My phone settings are not working.", question: /Wi-Fi.*brightness.*Bluetooth/i },
        { task: "I need to travel by train.", question: /cities/i },
        { task: "Book a flight ticket to Delhi.", question: /not bus or flight bookings/i },
        { task: "How do I hack the neighbor's Wi-Fi password?", question: /Wi-Fi.*brightness.*Bluetooth/i },
        { task: "What is the price of a Bluetooth speaker?", question: /Wi-Fi.*brightness.*Bluetooth/i },
        { task: "Find my train ticket receipt.", question: /simulated student portal/i }
    ];
    for (const scenario of cases) {
        const body = await (await server.postTask(scenario.task)).json();
        assert.equal(body.supported, false, scenario.task);
        assert.deepEqual(body.steps, [], scenario.task);
        assert.match(body.clarifyingQuestion, scenario.question, scenario.task);
    }
});

test("Gemini transient failure and daily quota still activate the local new-workflow plans", async t => {
    for (const [failure, task, expectedCategory, expectedMode] of [
        [Object.assign(new Error("service unavailable"), { status: 503 }), "I want to download my bonafide certificate.", "document_download", "fallback"],
        [Object.assign(new Error("daily quota exhausted"), { status: 429 }), "Teach me how to connect to Wi-Fi.", "smartphone_basics", "fallback"],
        [Object.assign(new Error("daily quota exhausted"), { status: 429 }), "Mujhe Bluetooth on karna hai.", "smartphone_basics", "fallback"],
        [Object.assign(new Error("service unavailable"), { status: 503 }), "Bluetooth band karna hai.", "smartphone_basics", "fallback"]
    ]) {
        const server = await startTestServer({ failure, retryDelayMs: 2 });
        t.after(server.close);
        const body = await (await server.postTask(task)).json();
        assert.equal(body.supported, true, task);
        assert.equal(body.category, expectedCategory, task);
        assert.equal(body.mode, expectedMode, task);
        assert.ok(body.steps.length > 0, task);
        if (/bluetooth/i.test(task)) {
            assert.equal(body.topic, "bluetooth", task);
            assert.deepEqual(body.steps.map(step => step.targetElementId), ["phoneSettings", "phoneBluetooth", "phoneToggle", "phoneBluetoothDone"], task);
        }
    }
});

test("Gemini plans for new workflows cannot introduce targets outside that workflow sequence", async t => {
    const newWorkflowPlan = {
        task: "Download my marksheet",
        category: "document_download",
        language: "en",
        instruction: "Open documents.",
        steps: ["documentOpen", "inventedDownload", "documentSample", "documentPreview", "documentDownload"].map(targetElementId => ({ instruction: "Use the highlighted control.", targetElementId })),
        clarifyingQuestion: ""
    };
    const server = await startTestServer({ response: JSON.stringify(newWorkflowPlan) });
    t.after(server.close);
    const body = await (await server.postTask("How do I download my marksheet?")).json();
    assert.equal(body.supported, false);
    assert.deepEqual(body.steps, []);
    assert.doesNotMatch(JSON.stringify(body), /inventedDownload/);
});

test("all static frontend routes and health endpoint respond through Express", async t => {
    const server = await startTestServer({ apiKey: "" });
    t.after(server.close);

    const routes = [
        ["/", /<title>Raasta \| Your AI guide to navigating the digital world<\/title>/],
        ["/index.html", /id="taskInput"/],
        ["/script.js", /function showGuide\(/],
        ["/style.css", /\.guide-layout/]
    ];
    for (const [route, expected] of routes) {
        const response = await server.request(route);
        assert.equal(response.status, 200, route);
        assert.match(response.body, expected, route);
    }
    assert.deepEqual(await (await server.request("/api/health")).json(), { ok: true, mode: "demo" });
});

test("health, request validation, and the existing three-target contract are preserved", async t => {
    const server = await startTestServer({ response: JSON.stringify(plan()) });
    t.after(server.close);

    assert.deepEqual(await (await server.request("/api/health")).json(), { ok: true, mode: "ai" });
    const badLanguage = await server.postTask("Download my college fee receipt.", "fr");
    assert.equal(badLanguage.status, 400);
    const tooShort = await server.postTask("fee");
    assert.equal(tooShort.status, 400);
    const response = await server.postTask("Download my college fee receipt.");
    assert.deepEqual((await response.json()).steps.map(step => step.targetElementId), targets);
});

test("Gemini request uses structured output and logs API and total durations separately", async t => {
    const logs = [];
    const logger = { info: message => logs.push(message), error() {} };
    const server = await startTestServer({ response: JSON.stringify(plan()), delayMs: 30, logger });
    t.after(server.close);

    const response = await server.postTask("Download my college fee receipt.");
    assert.equal(response.status, 200);
    assert.equal(server.calls.length, 1);
    const request = server.calls[0];
    assert.equal(request.generation_config.thinking_level, "low");
    assert.equal(request.generation_config.max_output_tokens, 2048);
    assert.equal(request.response_format.mime_type, "application/json");
    assert.match(request.input, /fee_receipt \(college\/hostel\/tuition\/semester fee receipt only/);
    assert.match(request.input, /train_booking/);
    assert.match(request.input, /document_download/);
    assert.match(request.input, /smartphone_basics/);
    assert.match(request.input, /document showing payment success/);
    assert.match(request.input, /money deducted/);
    await new Promise(resolve => setImmediate(resolve));
    assert.match(logs[0], /total=\d+ms geminiApi=\d+ms/);
    const [, totalMs, apiMs] = logs[0].match(/total=(\d+)ms geminiApi=(\d+)ms/);
    assert.ok(Number(apiMs) >= 25, `fake Gemini delay should be reflected, got ${apiMs}ms`);
    assert.ok(Number(totalMs) >= Number(apiMs));
});

test("Sarvam Hindi TTS uses the configured Bulbul persona and returns playable MP3 bytes", async t => {
    await withSarvamKey(TEST_SARVAM_KEY, async () => {
        let call;
        const server = await startTestServer({
            apiKey: "",
            fetchImpl: async (url, options) => {
                call = { url, options };
                return new Response(JSON.stringify({ audios: [Buffer.from("mock-mp3-audio").toString("base64")] }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }
        });
        t.after(server.close);

        const text = "नमस्ते! Documents खोलें और Fee Receipts चुनें।";
        const response = await server.post("/api/speech/hindi", { text, languageCode: "hi-IN" });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "audio/mpeg");
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(Buffer.from(response.body, "latin1").toString(), "mock-mp3-audio");
        assert.equal(call.url, "https://api.sarvam.ai/text-to-speech");
        const requestBody = JSON.parse(call.options.body);
        assert.deepEqual({ model: requestBody.model, speaker: requestBody.speaker, language_code: requestBody.language_code }, {
            model: "bulbul:v4-flash",
            speaker: "aparna_hi_customer",
            language_code: "hi-IN"
        });
        assert.equal(requestBody.enable_preprocessing, true);
        assert.equal(requestBody.output_audio_codec, "mp3");
        assert.equal(requestBody.text, text);
        assert.equal(call.options.headers["api-subscription-key"], TEST_SARVAM_KEY);
        assert.equal(call.options.headers.Authorization, undefined);
    });
});

test("Sarvam Hindi TTS reports a missing key without contacting the API", async t => {
    await withSarvamKey(null, async () => {
        let called = false;
        const server = await startTestServer({ apiKey: "", fetchImpl: async () => { called = true; } });
        t.after(server.close);
        const response = await server.post("/api/speech/hindi", { text: "नमस्ते", languageCode: "hi-IN" });
        assert.equal(response.status, 503);
        assert.match((await response.json()).error, /not configured/i);
        assert.equal(called, false);
    });
});

test("Sarvam TTS validates text, language, and the 2,500-character limit before fetching", async t => {
    await withSarvamKey(TEST_SARVAM_KEY, async () => {
        let called = false;
        const server = await startTestServer({ apiKey: "", fetchImpl: async () => { called = true; } });
        t.after(server.close);
        for (const body of [
            { text: "  ", languageCode: "hi-IN" },
            { text: "नमस्ते", languageCode: "en-IN" },
            { text: "क".repeat(2501), languageCode: "hi-IN" }
        ]) {
            const response = await server.post("/api/speech/hindi", body);
            assert.equal(response.status, 400);
        }
        const boundary = await server.post("/api/speech/hindi", { text: "क".repeat(2500), languageCode: "hi-IN" });
        assert.equal(boundary.status, 502, "valid-length request proceeds to the mocked upstream");
        assert.equal(called, true);
    });
});

test("Sarvam API errors and rate limits return controlled messages without upstream details", async t => {
    await withSarvamKey(TEST_SARVAM_KEY, async () => {
        for (const [upstreamStatus, expectedStatus, expectedMessage] of [
            [429, 503, /temporarily busy/i],
            [500, 502, /temporarily unavailable/i]
        ]) {
            const server = await startTestServer({ apiKey: "", fetchImpl: async () => new Response("secret upstream diagnostic", { status: upstreamStatus }) });
            t.after(server.close);
            const response = await server.post("/api/speech/hindi", { text: "नमस्ते", languageCode: "hi-IN" });
            assert.equal(response.status, expectedStatus);
            const body = await response.json();
            assert.match(body.error, expectedMessage);
            assert.doesNotMatch(JSON.stringify(body), /secret upstream diagnostic/i);
        }
    });
});

test("Sarvam TTS timeout aborts the upstream request and returns a controlled response", async t => {
    await withSarvamKey(TEST_SARVAM_KEY, async () => {
        let aborted = false;
        const server = await startTestServer({
            apiKey: "",
            sarvamTimeoutMs: 10,
            fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
                signal.addEventListener("abort", () => {
                    aborted = true;
                    reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
                }, { once: true });
            })
        });
        t.after(server.close);
        const response = await server.post("/api/speech/hindi", { text: "नमस्ते", languageCode: "hi-IN" });
        assert.equal(response.status, 504);
        assert.match((await response.json()).error, /too long/i);
        assert.equal(aborted, true);
    });
});

test("frontend regression: bilingual speech, guidance targets, and AI-plan restart remain wired", async () => {
    const script = await readFile(new URL("./script.js", import.meta.url), "utf8");
    const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
    assert.match(script, /window\.speechSynthesis/);
    assert.match(script, /hi-IN/);
    assert.match(script, /en-IN/);
    assert.match(script, /if \(activeRecognition\) return/);
    assert.match(script, /microphone access in your browser/);
    assert.match(script, /language\.setAttribute\("aria-label"/);
    assert.match(script, /Voice input is not supported in this browser/);
    assert.match(script, /showGuide\(task, plan, 0\)/);
    assert.match(script, /function previousStep\(\)/);
    assert.match(script, /previous\.onclick = previousStep/);
    assert.match(script, /next\.onclick = advanceStep/);
    assert.match(script, /if \(steps\[currentStep\]\.target === "portalDownload"\)[\s\S]*?receipt-visible/);
    assert.match(script, /speakText\(activeGuidance\?\.getCurrent\(\)\.instruction \|\| steps\[currentStep\]\.instruction, guide\.querySelector\("#visualSpeak"\)\)/);
    assert.match(script, /function handleGuideFollowUp\(value\)/);
    assert.match(script, /guidance-mode/);
    assert.match(script, /fetch\("\/api\/speech\/hindi"/);
    assert.match(script, /languageCode: "hi-IN"/);
    assert.match(script, /speechSynthesis\?\.cancel/);
    assert.match(script, /URL\.revokeObjectURL/);
    assert.match(script, /if \(id === "portalReceipts"\)[\s\S]*?receipt-visible/);
    assert.match(script, /This is a demo; no file was downloaded/);
    assert.match(script, /No real file was downloaded/);
    assert.match(script, /No real portal or file is used/);
    assert.match(script, /result\.mode === "fallback"/);
    assert.match(script, /setTaskStatus\(result\.message/);
    assert.match(script, /demoMode:\s*requestDemoMode/);
    assert.match(script, /function resetDemo\(\)/);
    for (const target of targets) assert.ok(script.includes(target), `missing frontend target ${target}`);
    assert.match(html, /id="language"[\s\S]*value="hi"/);
    assert.match(html, /id="language" aria-label="Interface language"/);
});

test("optional live Gemini hostel request reports actual API and backend timings", {
    skip: process.env.RAASTA_LIVE_GEMINI_TEST !== "1"
}, async t => {
    await import("dotenv/config");
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return t.skip("GEMINI_API_KEY is not configured in the process environment or .env file");

    const logs = [];
    const server = await startTestServer({
        apiKey,
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        logger: {
            info: message => logs.push(message),
            warn: message => logs.push(message),
            error: (...messages) => logs.push(messages.join(" "))
        },
        liveGemini: true
    });
    const response = await server.postTask(
        "I have already paid my college fees. Help me locate and download my hostel fee receipt."
    );
    const body = await response.json();
    if (response.status !== 200) {
        if (logs.some(message => typeof message === "string" && /APIConnectionError|ECONN|ENOTFOUND/.test(message))) {
            const timing = logs.find(message => typeof message === "string" && message.startsWith("[timing]"));
            console.info(`[live-gemini-unavailable] ${timing || "Gemini endpoint could not be reached"}`);
            return t.skip("The environment cannot connect to the Gemini API; no successful live latency was measured");
        }
        console.info(`[live-gemini-failure] status=${response.status} ${logs.filter(message => typeof message === "string").join(" | ")}`);
    }
    assert.equal(response.status, 200);
    if (body.mode !== "ai") {
        const timing = logs.find(message => typeof message === "string" && message.startsWith("[timing]"));
        const diagnostic = logs.filter(message => typeof message === "string" && message.startsWith("[gemini]"));
        console.info(`[live-gemini-no-success] mode=${body.mode} ${timing || "timing unavailable"} ${diagnostic.join(" | ")}`);
        return t.skip("The request used local fallback; Gemini did not complete, so this is not a successful live run");
    }
    assert.equal(body.supported, true);
    assert.deepEqual(body.steps.map(step => step.targetElementId), targets);
    await new Promise(resolve => setImmediate(resolve));
    const timing = logs.find(message => typeof message === "string" && message.startsWith("[timing]"));
    assert.ok(timing, "expected backend timing log");
    console.info(`[live-gemini-result] ${timing}`);
});
