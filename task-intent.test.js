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
