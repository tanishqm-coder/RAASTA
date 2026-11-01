const unrelatedReceiptPatterns = [
    /\btrain\s+(?:ki\s+)?(?:ticket|receipt)|\brailway\b|\bflight\s+(?:ticket|receipt)|\bbus\s+(?:ticket|receipt)|रेल\s*(?:की\s*)?(?:टिकट|रसीद)|ट्रेन\s*(?:की\s*)?(?:टिकट|रसीद)|बस\s*(?:की\s*)?(?:टिकट|रसीद)/u,
    /\belectricity\s+(?:ka\s+)?bill|\bpower\s+bill|\butility\s+bill|\bbijli\s+(?:ka\s+)?bill|बिजली\s*(?:का\s*)?बिल|विद्युत\s*बिल/u,
    /\bshopping\s+(?:ki\s+)?receipt|\bstore\s+receipt|\bpurchase\s+receipt|खरीदारी\s*(?:की\s*)?रसीद|दुकान\s*(?:की\s*)?रसीद/u,
    /\bbank\s+(?:ka\s+)?statement|\baccount\s+statement|बैंक\s*(?:(?:का|की)\s*)?(?:स्टेटमेंट|खाता\s*विवरण)/u,
    /\b(?:rent|rental|shopping|train|travel|flight|bus)\b.{0,60}\b(?:payment|receipt|proof|confirmation|document|ticket)|\b(?:rent|kiraya)\s+(?:payment\s+)?(?:proof|receipt)|किराया\s*(?:भुगतान\s*)?(?:की\s*)?(?:रसीद|प्रमाण)/u
];

const supportedFeeContextPattern = /\b(?:college|university|student\s+portal|campus|hostel|tuition|semester|academic)\b|कॉलेज|महाविद्यालय|विश्वविद्यालय|छात्र\s*पोर्टल|छात्रावास|हॉस्टल|ट्यूशन|सेमेस्टर|शैक्षणिक|कॉलेज\s*(?:की\s*)?फीस/u;
const feePattern = /\b(?:fees?|fess?)\b|फीस|शुल्क/u;
const receiptPattern = /\b(?:receipts?|reciept|recipt|rasid|raseed|raseet|parchi|parchee)\b|रसीद|पर्ची/u;
const paymentProofPattern = /\b(?:proof|saboot|confirmation|confirm|voucher|payment\s+slip|payment\s+proof|proof\s+of\s+payment)\b|प्रमाण|सबूत|भुगतान\s*(?:का|की)\s*प्रमाण|भुगतान\s*(?:की\s*)?पुष्टि/u;
const documentPattern = /\b(?:document|paperwork|documentary\s+proof)\b|दस्तावेज़|दस्तावेज|कागज़/u;
const paymentPattern = /\b(?:paid|pay(?:ment)?|money\s+(?:was\s+)?deducted|amount\s+(?:was\s+)?deducted|deducted|successful|successfully|charged|transaction)\b|\b(?:paise|paisa)\s*(?:kat|cut)|\b(?:kat|cut)\s*(?:gaye|gaya|gayi|gya)|\b(?:fees?|fess?)\s*(?:bhar|jama)|\b(?:bhar|jama)\s*(?:kar\s*)?(?:di|diya|diye|gayi|gaya|gaye|gyi|gya)|\b(?:kar\s*)?(?:diya|di|diye)\s*(?:hai\s*)?(?:payment|fees?)|\bpayment\s*(?:ho\s*)?(?:gaya|gayi|gya|gyi|successful)|भुगतान|जमा|कट\s*गए|कट\s*गयी|कटे|भरी|भरा|भरे|सफल|पैसे/u;

export function classifyReceiptIntent(task) {
    const text = typeof task === "string" ? task.normalize("NFKC").toLocaleLowerCase() : "";

    if (unrelatedReceiptPatterns.some(pattern => pattern.test(text))) return "unrelated";

    const broadInstitutionContext = /\b(?:college|university|student\s+portal|campus)\b|कॉलेज|महाविद्यालय|विश्वविद्यालय|छात्र\s*पोर्टल/u.test(text);
    const tuitionOrTermFee = /\b(?:tuition|semester|academic)\b|ट्यूशन|सेमेस्टर|शैक्षणिक/u.test(text);
    const hostelFeeContext = /\bhostel\b|हॉस्टल|छात्रावास/u.test(text);
    const feeContext = supportedFeeContextPattern.test(text) && (
        feePattern.test(text) || tuitionOrTermFee ||
        ((broadInstitutionContext || hostelFeeContext) && paymentPattern.test(text))
    );
    const hasReceiptArtifact = receiptPattern.test(text) ||
        (paymentProofPattern.test(text) && (feePattern.test(text) || paymentPattern.test(text))) ||
        (documentPattern.test(text) && paymentPattern.test(text));

    // A clearly scoped student fee receipt is supported. A generic payment or
    // receipt request stays ambiguous until the person identifies the fee.
    if (feeContext && hasReceiptArtifact) return "supported";
    return "ambiguous";
}
