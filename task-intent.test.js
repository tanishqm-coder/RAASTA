import test from "node:test";
import assert from "node:assert/strict";
import { classifyRaastaTask, classifyReceiptIntent, normalizeSpeechTranscript } from "./task-intent.js";

const supportedWorkflowRequests = [
    ["I want to book a train ticket.", "train_booking", null, "en"],
    ["Mujhe Jaipur se Delhi ki train book karni hai.", "train_booking", null, "hi"],
    ["How can I find trains between two cities?", "train_booking", null, "en"],
    ["I want to download my bonafide certificate.", "document_download", "bonafide", "en"],
    ["Mujhe apna document download karna hai.", "document_download", null, "hi"],
    ["How do I download my marksheet?", "document_download", "marksheet", "en"],
    ["Mujhe ID card download karna hai.", "document_download", "id_card", "hi"],
    ["Teach me how to connect to Wi-Fi.", "smartphone_basics", "wifi", "en"],
    ["Mujhe Wi-Fi connect karna sikhao.", "smartphone_basics", "wifi", "hi"],
    ["How do I increase my phone brightness?", "smartphone_basics", "brightness", "en"],
    ["How do I turn on Bluetooth?", "smartphone_basics", "bluetooth", "en"],
    ["Turn Bluetooth on.", "smartphone_basics", "bluetooth", "en"],
    ["Turn Bluetooth off.", "smartphone_basics", "bluetooth", "en"],
    ["Enable Bluetooth.", "smartphone_basics", "bluetooth", "en"],
    ["Mujhe Bluetooth on karna hai.", "smartphone_basics", "bluetooth", "hi"],
    ["Bluetooth chalu karo.", "smartphone_basics", "bluetooth", "hi"],
    ["Bluetooth band karna hai.", "smartphone_basics", "bluetooth", "hi"],
    ["मुझे Bluetooth चालू करना है।", "smartphone_basics", "bluetooth", "hi"],
    ["Bluetooth बंद कर दो।", "smartphone_basics", "bluetooth", "hi"],
    ["Teach me how to use my smartphone.", "smartphone_basics", null, "en"]
];

for (const [request, category, topic, language] of supportedWorkflowRequests) {
    test(`classifies supported Raasta workflow: ${request}`, () => {
        const result = classifyRaastaTask(request, language);
        assert.equal(result.supported, true);
        assert.equal(result.category, category);
        if (category === "smartphone_basics") assert.equal(result.topic, topic);
    });
}

test("train route is extracted from English and Hinglish requests", () => {
    const english = classifyRaastaTask("Book a train from Jaipur to Delhi.");
    const hinglish = classifyRaastaTask("Mujhe Jaipur se Delhi ki train book karni hai.", "hi");
    assert.deepEqual([english.source, english.destination], ["jaipur", "delhi"]);
    assert.deepEqual([hinglish.source, hinglish.destination], ["jaipur", "delhi"]);
});

const ambiguousWorkflowRequests = [
    ["Which document should I get?", /which document/i, "en"],
    ["My phone settings are not working.", /Wi-Fi.*brightness.*Bluetooth/i, "en"],
    ["I need to travel by train.", /cities/i, "en"]
];

for (const [request, expectedQuestion, language] of ambiguousWorkflowRequests) {
    test(`asks clarification for ambiguous workflow request: ${request}`, () => {
        const result = classifyRaastaTask(request, language);
        assert.equal(result.supported, false);
        assert.match(result.clarifyingQuestion, expectedQuestion);
    });
}

test("does not misclassify unsupported requests as one of the simulated workflows", () => {
    for (const request of [
        "Book a flight ticket to Delhi.",
        "I want to download a movie.",
        "I want free Wi-Fi without connecting to my own network.",
        "Help me hack the neighbor's Wi-Fi password.",
        "What is the price of a Bluetooth speaker?",
        "Recommend Bluetooth headphones.",
        "How do I change my laptop notification settings?",
        "Cancel my train ticket and refund it."
    ]) {
        assert.equal(classifyRaastaTask(request).supported, false, request);
    }
});

test("TV and HDMI tasks stay out of the specialised smartphone tutorial classifier", () => {
    for (const request of [
        "Turn on my TV.",
        "Mujhe TV chalu karni hai.",
        "How do I change the HDMI input?",
        "Connect my phone to my TV."
    ]) {
        const result = classifyRaastaTask(request);
        assert.equal(result.category, "unsupported", request);
        assert.equal(result.supported, false, request);
        assert.notEqual(result.category, "smartphone_basics", request);
    }
});

const speechCorrectionCases = [
    ["Mujhe fee receipt download karni hai.", "Mujhe fee receipt download karni hai."],
    ["Mujhe free receipt download karni hai.", "Mujhe fee receipt download karni hai."],
    ["I need my free payment receipt.", "I need my fee payment receipt."],
    ["Mujhe free mein receipt chahiye.", "Mujhe free mein receipt chahiye."],
    ["I want free software.", "I want free software."],
    ["Hostel fees ki receipt chahiye.", "Hostel fees ki receipt chahiye."]
];

for (const [input, expected] of speechCorrectionCases) {
    test(`speech transcript normalization: ${input}`, () => {
        assert.equal(normalizeSpeechTranscript(input), expected);
    });
}

const robustFeeReceiptRequests = [
    "Mujhe fee receipt download karni hai.",
    "Mujhe free receipt download karni hai.",
    "I need my free payment receipt.",
    "Maine hostel ki fees bhar di, receipt chahiye.",
    "Hostel fee ka proof download karna hai.",
    "College fees ki rasid chahiye.",
    "Mujhe semester fees ki receipt chahiye.",
    "मुझे हॉस्टल की फीस की रसीद डाउनलोड करनी है।",
    "मुझे सेमेस्टर फीस की रसीद चाहिए।"
];

for (const request of robustFeeReceiptRequests) {
    test(`recognizes Hindi/Hinglish fee receipt speech transcript: ${request}`, () => {
        assert.equal(classifyReceiptIntent(request), "supported");
    });
}

test("free wording without clear receipt action remains literal and non-supported", () => {
    assert.equal(classifyReceiptIntent("Mujhe free mein receipt chahiye."), "ambiguous");
    assert.equal(classifyReceiptIntent("I want free software."), "ambiguous");
});

const supportedRequests = [
    "I paid college fees already. Help me locate and download my hostel fee receipt.",
    "Please download my tuition fee receipt from the student portal.",
    "I need my semester fee receipt.",
    "Find my academic fee receipt.",
    "Show the college payment receipt.",
    "college payment receipt download karo",
    "कॉलेज की फीस जमा कर दी है, हॉस्टल फीस की रसीद डाउनलोड करनी है।",
    "मुझे ट्यूशन शुल्क की रसीद चाहिए।",
    "सेमेस्टर फीस की रसीद ढूँढो।",
    "Maine college fees pay kar di, hostel fee receipt download karni hai.",
    "Semester fees ki receipt student portal se chahiye.",
    "Hostel fees ki rasid download karni hai."
];

for (const request of supportedRequests) {
    test(`supports educational fee receipt: ${request}`, () => {
        assert.equal(classifyReceiptIntent(request), "supported");
    });
}

const naturalSupportedReceiptRequests = [
    "I paid my hostel fees. Where can I get proof?",
    "I paid my college fees already; show me the payment confirmation.",
    "Hostel fees bhar di, receipt kahan milegi?",
    "Maine hostel ki fees bhar di, payment ka proof kahan milega?",
    "मैंने हॉस्टल की फीस जमा कर दी है, रसीद कहाँ मिलेगी?"
];

for (const request of naturalSupportedReceiptRequests) {
    test(`understands natural payment receipt intent: ${request}`, () => {
        assert.equal(classifyReceiptIntent(request), "supported");
    });
}

const ambiguousPaymentRequests = [
    "How can I download my fee payment confirmation?",
    "My money was deducted but I cannot find the receipt.",
    "I need the document showing that my payment was successful.",
    "Fees jama ho gayi hai, ab receipt kaise nikalu?",
    "Paise kat gaye lekin payment ka proof nahi mil raha.",
    "Maine payment kar diya, ab uska document chahiye.",
    "Payment successful ho gaya par receipt nahi mil rahi.",
    "Jo payment karne ke baad milta hai woh download karna hai.",
    "मुझे फीस जमा करने का प्रमाण डाउनलोड करना है।",
    "पैसे कट गए हैं लेकिन भुगतान की रसीद नहीं मिल रही।"
];

for (const request of ambiguousPaymentRequests) {
    test(`asks what fee is meant when payment proof lacks student-fee context: ${request}`, () => {
        assert.equal(classifyReceiptIntent(request), "ambiguous");
    });
}

const unrelatedRequests = [
    "Find my train ticket receipt.",
    "Download the electricity bill receipt.",
    "I need a shopping receipt.",
    "Show my bank statement.",
    "Train ki ticket download karni hai.",
    "Bijli ka bill receipt chahiye.",
    "Shopping ki receipt find karo.",
    "Bank ka statement chahiye.",
    "ट्रेन की टिकट रसीद ढूँढो।",
    "बिजली का बिल डाउनलोड करना है।"
];

for (const request of unrelatedRequests) {
    test(`rejects unrelated receipt: ${request}`, () => {
        assert.equal(classifyReceiptIntent(request), "unrelated");
    });
}

test("asks for clarification when receipt intent is unclear", () => {
    assert.equal(classifyReceiptIntent("Please help me find my receipt."), "ambiguous");
    assert.equal(classifyReceiptIntent("I need a fee receipt."), "ambiguous");
    assert.equal(classifyReceiptIntent("I paid for something but need the proof."), "ambiguous");
    assert.equal(classifyReceiptIntent("I need confirmation of my semester schedule."), "ambiguous");
});

test("does not treat unrelated bill payments as student fee receipts", () => {
    assert.equal(classifyReceiptIntent("I paid my electricity bill and need its receipt."), "unrelated");
    assert.equal(classifyReceiptIntent("Train ki ticket ka payment proof chahiye."), "unrelated");
    assert.equal(classifyReceiptIntent("Shopping ka payment successful tha, receipt chahiye."), "unrelated");
    assert.equal(classifyReceiptIntent("I need a receipt for rent payment."), "unrelated");
    assert.equal(classifyReceiptIntent("I need a receipt for my hostel security deposit."), "ambiguous");
});
