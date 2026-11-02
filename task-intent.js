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

const receiptActionPattern = /\b(?:download|find|locate|get|show|where|receive|chahiye|nikal(?:na|ni)?|dhundh(?:na|ni)?|milegi|milega|mil|kar(?:na|ni)\s+hai)\b|चाहिए|चाहिये|डाउनलोड|ढूँढ|ढूंढ|कहाँ|कहा|मिलेगी|मिलेगा/u;

/**
 * Correct only a high-confidence speech substitution: "free" immediately
 * before a receipt artifact in a request to find/download/get it. Ordinary
 * uses such as "free mein receipt" or "free software" remain untouched.
 */
export function normalizeSpeechTranscript(task) {
    if (typeof task !== "string") return "";
    const text = task.normalize("NFKC");
    const hasFreeReceiptPhrase = /\bfree\s+(?:fee\s+)?(?:payment\s+)?(?:receipts?|reciept|recipt|rasid|raseed|raseet|parchi|parchee)\b/i.test(text);
    const needsOrWantsPaymentReceipt = /\bfree\s+payment\s+(?:receipt|reciept|recipt)\b/i.test(text) && /\b(?:need|want)\b/i.test(text);
    if (!hasFreeReceiptPhrase || (!receiptActionPattern.test(text) && !needsOrWantsPaymentReceipt)) return text;
    return text.replace(/\bfree(?=\s+(?:fee\s+)?(?:payment\s+)?(?:receipts?|reciept|recipt|rasid|raseed|raseet|parchi|parchee)\b)/i, "fee");
}

export function classifyReceiptIntent(task) {
    const text = normalizeSpeechTranscript(task).toLocaleLowerCase();

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
    const explicitFeeReceiptRequest = feePattern.test(text) && receiptPattern.test(text) && receiptActionPattern.test(text);
    const correctedPaymentReceiptRequest = normalizeSpeechTranscript(task) !== (typeof task === "string" ? task.normalize("NFKC") : "") &&
        /\b(?:fee\s+)?payment\s+receipts?\b/i.test(text);

    // A clearly scoped student fee receipt is supported. A generic payment or
    // receipt request stays ambiguous until the person identifies the fee.
    if ((feeContext && hasReceiptArtifact) || explicitFeeReceiptRequest || correctedPaymentReceiptRequest) return "supported";
    return "ambiguous";
}

const trainPattern = /\b(?:train|trains|railway|rail|ticket|tickets|book\s+me\s+a\s+train|book\s+(?:a\s+)?train|reserve\s+(?:a\s+)?train|find\s+trains?)\b|ट्रेन|रेल|रेलगाड़ी|टिकट/u;
const trainContextPattern = /\b(?:train|trains|railway|rail)\b|ट्रेन|रेल|रेलगाड़ी/u;
const otherTravelPattern = /\b(?:flight|flights|plane|airplane|bus|buses)\b|हवाई\s*जहाज़|बस/u;
const trainActionPattern = /\b(?:book|reserve|find|search|schedule|between|chahiye)\b|बुक|खोज|ढूँढ|चाहिए|करनी\s+है|करना\s+है/u;
const workflowDocumentPattern = /\b(?:documents?|bonafide|bona\s*fide|certificate|certificates|marksheet|mark\s*sheet|transcript|id\s*card|identity\s*card|paperwork)\b|दस्तावेज़?|प्रमाणपत्र|बोनाफाइड|मार्कशीट|अंकपत्र|पहचान\s*पत्र/u;
const documentActionPattern = /\b(?:download|get|find|show|need|want|where|retrieve|open)\b|डाउनलोड|चाहिए|चाहिये|ढूँढ|ढूंढ|कहाँ|कहा|निकाल/u;
const phonePattern = /\b(?:phone|smartphone|mobile|wifi|wi[ -]?fi|brightness|screen\s+brightness|bluetooth|settings)\b|फोन|स्मार्टफोन|मोबाइल|वाई[ -]?फाई|वाईफाई|ब्राइटनेस|चमक|ब्लूटूथ|सेटिंग/u;
const tutorialActionPattern = /\b(?:teach|learn|show|help|how|connect|turn\s+(?:on|off)|increase|decrease|adjust|change|enable|disable|use)\b|सिखा|सीख|बताओ|मदद|कैसे|जोड़|चालू|बंद|बढ़ा|कम|बदल/u;

function detectedDocumentType(text) {
    if (/\b(?:bonafide|bona\s*fide)\b|बोनाफाइड|प्रमाणपत्र/u.test(text)) return "bonafide";
    if (/\b(?:marksheet|mark\s*sheet|transcript)\b|मार्कशीट|अंकपत्र/u.test(text)) return "marksheet";
    if (/\b(?:id\s*card|identity\s*card)\b|पहचान\s*पत्र/u.test(text)) return "id_card";
    if (/\bfee\s+receipt\b|फीस.{0,12}(?:रसीद|पर्ची)/u.test(text)) return "fee_receipt";
    return null;
}

function detectedPhoneTopic(text) {
    if (/\b(?:wifi|wi[ -]?fi)\b|वाई[ -]?फाई|वाईफाई/u.test(text)) return "wifi";
    if (/\bbrightness\b|ब्राइटनेस|चमक/u.test(text)) return "brightness";
    if (/\bbluetooth\b|ब्लूटूथ/u.test(text)) return "bluetooth";
    return null;
}

function hasPhoneTopicAction(topic, text) {
    if (topic === "wifi") return /\b(?:connect|join|set\s+up|enable|turn\s+on|choose\s+(?:a\s+)?network|jod(?:o|na)|chalu)\b|जोड़|कनेक्ट|नेटवर्क\s+चुन|चालू\s+कर/u.test(text);
    if (topic === "brightness") return /\b(?:increase|decrease|adjust|change|set|lower|raise|badha(?:o|na|ni)|kam\s+karo|adjust\s+karo)\b|बढ़ा|कम\s+कर|बदल|समायोजित/u.test(text);
    if (topic === "bluetooth") return /\b(?:(?:turn|switch)\s+(?:bluetooth\s+)?(?:on|off)|toggle|enable|disable|connect|chalu|band|(?:on|off)\s+kar(?:na|ni|do|dijiye)|(?:on|off)\s+karo)\b|चालू|बंद|टॉगल|जोड़|कनेक्ट/u.test(text);
    return false;
}

/** Classifies only the four simulated journeys Raasta can safely demonstrate. */
export function classifyRaastaTask(task, language = "en") {
    const text = normalizeSpeechTranscript(task).toLocaleLowerCase();
    const hasReceiptArtifact = /\b(?:receipt|proof|confirmation|voucher)\b|रसीद|पर्ची|प्रमाण/u.test(text);
    const receiptIntent = classifyReceiptIntent(task);

    if (receiptIntent === "supported") {
        return { category: "fee_receipt", supported: true, documentType: "fee_receipt", topic: null };
    }
    // A train ticket receipt remains outside the fee workflow; a clear booking request is supported.
    if (otherTravelPattern.test(text)) {
        return { category: "unsupported", supported: false, clarifyingQuestion: language === "hi"
            ? "Raasta अभी केवल simulated ट्रेन यात्रा में मदद करता है, बस या विमान बुकिंग में नहीं।"
            : "Raasta currently supports simulated train journeys, not bus or flight bookings." };
    }
    if (trainContextPattern.test(text) && /\b(?:download|cancel|refund|track|status|platform|delay)\b|डाउनलोड|रद्द/u.test(text)) {
        return { category: "unsupported", supported: false, clarifyingQuestion: language === "hi"
            ? "Raasta अभी केवल simulated ट्रेन बुकिंग में मदद करता है, मौजूदा टिकट डाउनलोड या बदलने में नहीं।"
            : "Raasta currently guides simulated train bookings, not downloads or changes to existing tickets." };
    }
    if (trainContextPattern.test(text) && trainActionPattern.test(text) && !hasReceiptArtifact) {
        const route = text.match(/\bfrom\s+([\p{L}][\p{L} .'-]{0,35}?)\s+to\s+([\p{L}][\p{L} .'-]{0,35}?)(?:\s|[?.!,]|$)/u) ||
            text.match(/\b([\p{L}]+)\s+se\s+([\p{L}]+)\s+ki\s+train/u) ||
            text.match(/([\p{Script=Devanagari}]+)\s+से\s+([\p{Script=Devanagari}]+)\s+की\s+ट्रेन/u);
        return { category: "train_booking", supported: true, source: route?.[1]?.trim() || "", destination: route?.[2]?.trim() || "", topic: null };
    }
    if (receiptIntent === "unrelated" && hasReceiptArtifact) {
        return { category: "unsupported", supported: false, clarifyingQuestion: language === "hi"
            ? "Raasta अभी simulated छात्र पोर्टल में कॉलेज, हॉस्टल, ट्यूशन और सेमेस्टर फीस की रसीद में मदद करता है। क्या आपको इनमें से किसी रसीद की मदद चाहिए?"
            : "Raasta currently guides college, hostel, tuition, and semester fee receipts in a simulated student portal. Is one of those what you need?" };
    }

    const phoneTopic = detectedPhoneTopic(text);
    const distinctHeadphonePairing = /\b(?:headphones?|earbuds?|headset)\b|हेडफोन|ईयरबड/u.test(text) && phoneTopic === "bluetooth";
    const computerContext = /\b(?:laptop|computer|desktop|pc|windows|mac(?:book)?)\b|लैपटॉप|कंप्यूटर|विंडोज़?|मैकबुक?/u.test(text);
    const tvContext = /\b(?:tv|television|monitor|hdmi)\b|टीवी|टेलीविज़न/u.test(text);
    const computerWifiTask = computerContext && phoneTopic === "wifi";
    const phoneHotspotTask = /\b(?:hotspot|personal\s+hotspot|tethering)\b|हॉटस्पॉट|टेथरिंग/u.test(text);
    if (phonePattern.test(text) && !computerContext && !tvContext && !distinctHeadphonePairing && !computerWifiTask && !phoneHotspotTask && (hasPhoneTopicAction(phoneTopic, text) || (!phoneTopic && (tutorialActionPattern.test(text) || /\b(?:sikha|sikhao|seekho|seekhna|kaise|batao)\b/u.test(text))))) {
        return { category: "smartphone_basics", supported: true, topic: phoneTopic, documentType: null };
    }

    const requestedDocument = detectedDocumentType(text);
    if (workflowDocumentPattern.test(text) && !requestedDocument && /\b(?:which|what)\s+(?:document|certificate|paperwork)\b|कौन\s*सा\s+दस्तावेज़?/u.test(text)) {
        return { category: "unsupported", supported: false, clarifyingQuestion: language === "hi"
            ? "आप कौन-सा दस्तावेज़ ढूँढ रहे हैं—बोनाफाइड प्रमाणपत्र, मार्कशीट, ID कार्ड या फीस रसीद?"
            : "Which document do you need—bonafide certificate, marksheet, ID card, or fee receipt?" };
    }
    if (workflowDocumentPattern.test(text) && (requestedDocument || documentActionPattern.test(text))) {
        return { category: "document_download", supported: true, documentType: requestedDocument, topic: null };
    }

    if (trainPattern.test(text) && hasReceiptArtifact) {
        return { category: "unsupported", supported: false, clarifyingQuestion: language === "hi"
            ? "यह ट्रेन टिकट की रसीद है। Raasta केवल कॉलेज फीस रसीद के simulated workflow में मदद करता है।"
            : "That sounds like a train ticket receipt. Raasta only supports the simulated college fee receipt workflow for receipts." };
    }

    if (phonePattern.test(text) && !computerContext && !tvContext) {
        return { category: "unsupported", supported: false, clarifyingQuestion: language === "hi"
            ? "आप Wi-Fi जोड़ना, स्क्रीन की चमक बदलना या Bluetooth चालू करना सीखना चाहते हैं?"
            : "Would you like help with Wi-Fi, screen brightness, or Bluetooth on your phone?" };
    }
    if (workflowDocumentPattern.test(text)) {
        return { category: "unsupported", supported: false, clarifyingQuestion: language === "hi"
            ? "आप कौन-सा दस्तावेज़ ढूँढ रहे हैं—बोनाफाइड प्रमाणपत्र, मार्कशीट, ID कार्ड या फीस रसीद?"
            : "Which document do you need—bonafide certificate, marksheet, ID card, or fee receipt?" };
    }
    if (trainPattern.test(text)) {
        if (/\b(?:cancel|refund|status|platform|delay)\b/u.test(text)) {
            return { category: "unsupported", supported: false, clarifyingQuestion: language === "hi"
                ? "Raasta अभी केवल simulated ट्रेन बुकिंग में मदद करता है, टिकट रद्द करने या स्थिति जाँचने में नहीं।"
                : "Raasta currently guides simulated train bookings, not cancellations, refunds, or live train status." };
        }
        return { category: "unsupported", supported: false, clarifyingQuestion: trainContextPattern.test(text)
            ? (language === "hi" ? "कृपया शुरुआती और गंतव्य शहर बताइए।" : "Which cities are you travelling between?")
            : (language === "hi" ? "Raasta अभी केवल फीस रसीद, ट्रेन यात्रा, दस्तावेज़ डाउनलोड और फोन ट्यूटोरियल में मदद करता है।" : "Raasta currently guides fee receipts, train journeys, document downloads, and phone tutorials.") };
    }
    if (receiptIntent === "ambiguous") return { category: "unsupported", supported: false };
    return { category: "unsupported", supported: false, clarifyingQuestion: language === "hi"
        ? "Raasta अभी simulated फीस रसीद, ट्रेन बुकिंग, दस्तावेज़ डाउनलोड और कुछ फोन सेटिंग्स में मदद कर सकता है। आप क्या करना चाहते हैं?"
        : "Raasta can guide simulated fee receipts, train bookings, document downloads, and a few phone settings. What would you like to do?" };
}
