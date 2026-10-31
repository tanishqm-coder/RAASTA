import test from "node:test";
import assert from "node:assert/strict";
import { classifyReceiptIntent } from "./task-intent.js";

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
});
