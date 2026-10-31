const unrelatedReceiptPatterns = [
    /\btrain\s+(?:ki\s+)?(?:ticket|receipt)|\brailway\b|\bflight\s+(?:ticket|receipt)|\bbus\s+(?:ticket|receipt)|रेल\s*(?:की\s*)?(?:टिकट|रसीद)|ट्रेन\s*(?:की\s*)?(?:टिकट|रसीद)|बस\s*(?:की\s*)?(?:टिकट|रसीद)/u,
    /\belectricity\s+(?:ka\s+)?bill|\bpower\s+bill|\butility\s+bill|\bbijli\s+(?:ka\s+)?bill|बिजली\s*(?:का\s*)?बिल|विद्युत\s*बिल/u,
    /\bshopping\s+(?:ki\s+)?receipt|\bstore\s+receipt|\bpurchase\s+receipt|खरीदारी\s*(?:की\s*)?रसीद|दुकान\s*(?:की\s*)?रसीद/u,
    /\bbank\s+(?:ka\s+)?statement|\baccount\s+statement|बैंक\s*(?:(?:का|की)\s*)?(?:स्टेटमेंट|खाता\s*विवरण)/u
];

const educationContextPattern = /\b(?:college|university|school|student|campus|hostel|tuition|semester|academic|education)\b|कॉलेज|महाविद्यालय|विश्वविद्यालय|स्कूल|छात्र|छात्रावास|हॉस्टल|ट्यूशन|सेमेस्टर|शैक्षणिक|शिक्षा/u;
const feePattern = /\b(?:fee|fees|tuition|semester|academic|hostel|payment)\b|फीस|शुल्क|ट्यूशन|सेमेस्टर|शैक्षणिक|छात्रावास|हॉस्टल|भुगतान/u;
const receiptPattern = /\b(?:receipt|receipts|rasid|raseed|payment\s+proof|payment\s+receipt|proof\s+of\s+payment)\b|रसीद|भुगतान\s*(?:का\s*)?प्रमाण/u;

export function classifyReceiptIntent(task) {
    const text = typeof task === "string" ? task.normalize("NFKC").toLocaleLowerCase() : "";

    if (unrelatedReceiptPatterns.some(pattern => pattern.test(text))) return "unrelated";
    if (educationContextPattern.test(text) && feePattern.test(text) && receiptPattern.test(text)) {
        return "supported";
    }
    return "ambiguous";
}
