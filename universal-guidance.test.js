import test from "node:test";
import assert from "node:assert/strict";
import { classifyUniversalRequest, createLocalUniversalPlan } from "./universal-guidance.js";

const localGuides = [
    ["I want to turn on my PS5.", "en", /power cable/i, /power-marked button/i],
    ["How can I start my PlayStation?", "en", /power cable/i, /power-marked button/i],
    ["Mera PS5 chalu kaise karu?", "hi", /पावर केबल/, /power निशान/],
    ["PS5 ko on karna hai.", "hi", /पावर केबल/, /power निशान/],
    ["Mujhe PS 5 chalu karna hai.", "hi", /पावर केबल/, /power निशान/],
    ["How do I connect my laptop to a TV?", "en", /HDMI cable/i, /Input\/Source/i],
    ["Turn on my TV.", "en", /working outlet/i, /physical button/i],
    ["How do I switch on my television?", "en", /working outlet/i, /physical button/i],
    ["Mujhe TV chalu karni hai.", "hi", /काम कर रहे socket/i, /physical button/i],
    ["muje tv chalu karni hai", "hi", /काम कर रहे socket/i, /physical button/i],
    ["TV on kaise karu?", "hi", /TV की cable/i, /एक बार दबाएँ/],
    ["टीवी चालू करनी है।", "hi", /socket/i, /TV के सामने वाले किनारे/i],
    ["How do I turn off my TV?", "en", /recording or update/i, /standby/i],
    ["TV band karni hai.", "hi", /recording या update/i, /standby light/i],
    ["Mera television start nahi ho raha.", "hi", /power cable/i, /casing न खोलें/i],
    ["How do I change the HDMI input?", "en", /Input, Source/i, /HDMI 1/i],
    ["Change HDMI input.", "en", /Input, Source/i, /HDMI 1/i],
    ["How do I connect my phone to my TV?", "en", /Not every phone/i, /only if it appears/i],
    ["I want to connect my phone to Bluetooth headphones.", "en", /pairing mode/i, /Choose your headphone name/i],
    ["Connect Bluetooth headphones to my laptop.", "en", /pairing mode/i, /Windows.*Mac/i],
    ["Connect bluetooh headphones to my laptop.", "en", /pairing mode/i, /Windows.*Mac/i],
    ["Mujhe laptop par Bluetooth headphones connect karne hain.", "hi", /pairing mode/, /Windows.*Mac/],
    ["How do I take a screenshot on Windows?", "en", /screen/i, /Windows\+Shift\+S/i],
    ["Mujhe apne phone ka hotspot on karna hai.", "hi", /Settings में search/, /स्विच चालू/],
    ["How do I connect my laptop to Wi-Fi?", "en", /Wi-Fi is on/i, /password/i],
    ["Wi-Fi troubleshooting", "en", /Wi-Fi is on/i, /network owner/i],
    ["How do I install an application on my laptop?", "en", /official website/i, /system requirements/i],
    ["Mujhe Gmail account banana hai.", "hi", /accounts\.google\.com/, /पासवर्ड/],
    ["How do I turn on location services on Android?", "en", /Location can reveal/i, /search for Location/i]
];

for (const [task, language, firstStep, laterStep] of localGuides) {
    test(`creates safe local universal guidance: ${task}`, () => {
        const plan = createLocalUniversalPlan(task, language, "demo");
        assert.equal(plan?.category, "universal_guidance");
        assert.equal(plan?.supported, true);
        assert.ok(plan.steps.length >= 2 && plan.steps.length <= 8);
        assert.match(plan.steps[0].instruction, firstStep, "first-step guidance should fit the requested task");
        assert.ok(plan.steps.some(step => laterStep.test(step.instruction)), "expected specific action in the plan");
        assert.ok(plan.steps.every(step => !Object.hasOwn(step, "targetElementId")), "universal advice must not invent UI targets");
    });
}

test("asks for a platform when location controls cannot be safely named", () => {
    const plan = createLocalUniversalPlan("How do I turn on location services?", "en", "demo");
    assert.equal(plan.supported, false);
    assert.match(plan.clarifyingQuestion, /which device and system/i);
});

test("asks for router or platform details before changing a Wi-Fi password", () => {
    const plan = createLocalUniversalPlan("How do I change my Wi-Fi password?", "en", "fallback");
    assert.equal(plan.supported, false);
    assert.match(plan.clarifyingQuestion, /router.*saved password/i);
});

test("destructive reset requests ask for confirmation and backup details instead of instructions", () => {
    const plan = createLocalUniversalPlan("How do I factory reset my laptop?", "en", "demo");
    assert.equal(plan.supported, false);
    assert.match(plan.clarifyingQuestion, /could erase your data/i);
    assert.match(plan.clarifyingQuestion, /backup/i);
    assert.deepEqual(plan.steps, []);

    const directRequest = createLocalUniversalPlan("Factory reset my laptop.", "en", "demo");
    assert.equal(directRequest.supported, false);
    assert.match(directRequest.clarifyingQuestion, /could erase your data/i);
});

test("unknown browser settings requests ask which browser and setting", () => {
    const task = "Navigate common browser settings";
    assert.equal(classifyUniversalRequest(task).digital, true);
    const plan = createLocalUniversalPlan(task, "en", "demo");
    assert.equal(plan.supported, false);
    assert.match(plan.clarifyingQuestion, /which browser.*which setting/i);
});

test("does not turn an unrelated or ambiguous request into a digital guide", () => {
    assert.equal(classifyUniversalRequest("What should I cook for dinner?").digital, false);
    assert.equal(createLocalUniversalPlan("I need help.", "en", "demo"), null);
    const unknownDigitalTask = createLocalUniversalPlan("How do I change my laptop notification settings?", "en", "demo");
    assert.equal(unknownDigitalTask.supported, false);
    assert.match(unknownDigitalTask.clarifyingQuestion, /which device or model/i);
});

test("unknown digital requests remain eligible for Gemini universal guidance", () => {
    assert.equal(classifyUniversalRequest("How do I change my laptop notification settings?").digital, true);
    assert.equal(classifyUniversalRequest("I need to forward an email").digital, true);
    const offlineClarification = createLocalUniversalPlan("I need to forward an email", "en", "fallback");
    assert.equal(offlineClarification.supported, false);
    assert.match(offlineClarification.clarifyingQuestion, /which device or model/i);
});

test("TV power and input guides acknowledge remote and model differences without assuming a smart TV", () => {
    const power = createLocalUniversalPlan("Turn on my TV.", "en", "demo");
    assert.ok(power.steps.length >= 4);
    assert.match(power.steps[1].instruction, /remote|physical button/i);
    assert.match(power.steps[1].instruction, /side|underside/i);
    assert.match(power.steps[3].instruction, /power indicator|Input\/Source/i);

    const laptop = createLocalUniversalPlan("Connect my laptop to my TV.", "en", "demo");
    assert.match(laptop.steps[0].instruction, /not every TV is a smart TV/i);
    assert.match(laptop.steps[2].instruction, /Input\/Source/i);

    const phone = createLocalUniversalPlan("Connect my phone to my TV.", "en", "demo");
    assert.match(phone.steps[0].instruction, /Not every phone can cast/i);
});
