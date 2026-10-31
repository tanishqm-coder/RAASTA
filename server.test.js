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

async function startTestServer({
    apiKey = "test-key", model = "test-flash", response, failure, outcomes,
    delayMs = 0, deadlineMs = 15_000, retryDelayMs = 250, logger, liveGemini = false
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
        postTask: (task, language = "en") => request("POST", "/api/understand-task", { task, language })
    };
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
    assert.match(request.input, /hostel, tuition, semester, academic/);
    await new Promise(resolve => setImmediate(resolve));
    assert.match(logs[0], /total=\d+ms geminiApi=\d+ms/);
    const [, totalMs, apiMs] = logs[0].match(/total=(\d+)ms geminiApi=(\d+)ms/);
    assert.ok(Number(apiMs) >= 25, `fake Gemini delay should be reflected, got ${apiMs}ms`);
    assert.ok(Number(totalMs) >= Number(apiMs));
});

test("frontend regression: bilingual speech, guidance targets, and AI-plan restart remain wired", async () => {
    const script = await readFile(new URL("./script.js", import.meta.url), "utf8");
    const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
    assert.match(script, /window\.speechSynthesis/);
    assert.match(script, /hi-IN/);
    assert.match(script, /en-IN/);
    assert.match(script, /showGuide\(task, plan, 0\)/);
    assert.match(script, /result\.mode === "fallback"/);
    assert.match(script, /GEMINI_API_KEY/);
    for (const target of targets) assert.ok(script.includes(target), `missing frontend target ${target}`);
    assert.match(html, /id="language"[\s\S]*value="hi"/);
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
