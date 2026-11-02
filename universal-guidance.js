const digitalContext = /\b(?:phone|smartphone|mobile|laptop|computer|pc|windows|mac(?:book)?|tv|television|screen|ps5|playstation|console|controller|headphones?|earbuds?|bluetooth|wi[ -]?fi|wifi|hotspot|screenshot|app(?:lication)?|software|gmail|google\s+account|location|router|internet|browser|device|settings?|email|e-mail|printer|scanner|file|folder|cloud|account|website|network|password|notification|camera|keyboard|mouse|tablet|projector|usb|hdmi|display|storage|backup|security|login|sign[ -]?in|upload|download|smartwatch|qr\s+code|operating\s+system)\b|फोन|मोबाइल|लैपटॉप|कंप्यूटर|विंडोज़?|टीवी|टेलीविज़न|प्लेस्टेशन|कंसोल|हेडफोन|ब्लूटूथ|वाई[ -]?फाई|वाईफाई|हॉटस्पॉट|स्क्रीनशॉट|ऐप|जीमेल|गूगल\s*अकाउंट|लोकेशन|राउटर|इंटरनेट|डिवाइस|सेटिंग|ईमेल|प्रिंटर|फ़ाइल|फाइल|फ़ोल्डर|फोल्डर|अकाउंट|पासवर्ड|नोटिफिकेशन|कैमरा|कीबोर्ड|माउस|टैबलेट|स्टोरेज/u;
const digitalAction = /\b(?:how|help|want|need|teach|show|turn|switch|power|start|connect|pair|enable|disable|on|off|take|capture|change|update|troubleshoot(?:ing)?|trouble|fix|problem|issue|not\s+working|doesn.t\s+connect|install|create|set\s*up|setup|find|use|open|navigate|configure|manage|forward|send|share|save|move|print|scan|adjust|zoom|log\s*in|log\s*out|sign\s*in|sign\s*out|reset|delete|erase|wipe|format|purchase|pay(?:ment)?|chalu|band|jod(?:o|na)|banana|karna|karo|kaise|sikha(?:o|na))\b|कैसे|चालू|बंद|जोड़|बनाना|करना|करो|सिखा|बताओ|बदल|रीसेट|हटाओ|मिटाओ|इंस्टॉल|खोल|काम\s*नहीं|जुड़\s*नहीं|भेज|सहेज/u;
const destructiveTask = /\b(?:factory\s+reset|wipe(?:\s+(?:the\s+)?(?:device|phone|laptop|drive|disk))?|format\s+(?:the\s+)?(?:drive|disk|device)|erase\s+all|delete\s+(?:my\s+)?(?:account|all\s+files|everything)|reset\s+(?:my\s+)?(?:phone|laptop|computer|device)\s+to\s+factory)\b|फ़ैक्टरी\s*रीसेट|सब\s*(?:डेटा|फ़ाइलें)\s*मिटा/u;

function contains(text, pattern) { return pattern.test(text); }
function normalizeUniversalTranscript(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase()
        .replace(/\bplay\s*station\b/gu, "playstation")
        .replace(/\bps[\s-]*5\b/gu, "ps5")
        .replace(/\bblue(?:tooh|toothh)\b/gu, "bluetooth")
        .replace(/\bhead\s+phones?\b/gu, "headphones")
        .replace(/\bwi[\s-]+fi\b/gu, "wifi")
        .replace(/\bhot\s*spot\b/gu, "hotspot")
        .replace(/\bscreen\s+shot\b/gu, "screenshot");
}
const extendedDigitalContext = /\b(?:portal|student|college|university|school|exam|examination|result|marks)\b|पोर्टल|छात्र|कॉलेज|विश्वविद्यालय|परीक्षा|रिजल्ट|परिणाम|अंक/u;
const extendedDigitalAction = /\b(?:check|view|look|verify|access)\b|देख|जाँच/u;
function isDigitalRequest(text) {
    return (contains(text, digitalContext) || contains(text, extendedDigitalContext)) &&
        (contains(text, digitalAction) || contains(text, extendedDigitalAction));
}
const disallowedIntent = /\b(?:hack|crack|bypass|steal|phish|spy\s+on|break\s+into|malware|ransomware|keylogger|spyware|make\s+(?:a\s+)?bomb|explosive|disable\s+(?:antivirus|security)|evade\s+security)\b|हैक|चोरी\s*कर|बम\s*बना/u;

function makeStep(title, instruction) { return { title, instruction }; }

function localSteps(text, isHindi) {
    const hi = isHindi;
    const has = pattern => contains(text, pattern);
    const playstation = /\b(?:ps5|playstation|console)\b|प्लेस्टेशन|पीएस\s*5/u;
    const controller = /\b(?:controller|dualsense|gamepad)\b|कंट्रोलर/u;
    const laptop = /\b(?:laptop|computer|pc|windows|mac(?:book)?)\b|लैपटॉप|कंप्यूटर|विंडोज़?|मैकबुक?/u;
    const tv = /\b(?:tv|television|monitor)\b|टीवी|टेलीविज़न/u;
    const phone = /\b(?:phone|smartphone|mobile|android|iphone|ios)\b|फोन|मोबाइल|एंड्रॉयड|आईफोन/u;

    if (has(playstation) && has(controller) && /\b(?:connect|pair|bluetooth|wireless)\b|जोड़|कनेक्ट|पेयर/u.test(text)) return [
        makeStep(hi ? "कंसोल और कंट्रोलर तैयार करें" : "Prepare the console and controller", hi ? "PS5 चालू रखें और कंट्रोलर में चार्ज हो। यदि आपका कंट्रोलर DualSense नहीं है, तो उसके निर्माता के pairing निर्देश देखें।" : "Turn on the PS5 and make sure the controller has charge. If it is not a DualSense, check its manufacturer's pairing instructions."),
        makeStep(hi ? "पहली बार USB केबल से जोड़ें" : "Connect by USB for first pairing", hi ? "पहली pairing के लिए कंट्रोलर को PS5 से supplied USB cable से जोड़ें। केवल charging वाली cable काम न करे तो दूसरी data cable आज़माएँ।" : "For first pairing, connect the controller to the PS5 with the supplied USB cable. If a charge-only cable does not pair it, try a data-capable cable."),
        makeStep(hi ? "PS बटन दबाएँ" : "Press the PS button", hi ? "PlayStation लोगो वाला PS बटन दबाएँ। light bar blink करे और player indicator जले तो pairing पूरी होनी चाहिए।" : "Press the PS button with the PlayStation logo. The light bar should blink and the player indicator should light when pairing completes."),
        makeStep(hi ? "अतिरिक्त कंट्रोलर वायरलेस जोड़ें" : "Pair an additional controller wirelessly", hi ? "यदि यह अतिरिक्त DualSense है, तो पहले से जुड़े कंट्रोलर से Settings > Accessories > General > Bluetooth Accessories खोलें। नए कंट्रोलर पर Create और PS बटन साथ दबाकर light blink होने दें, फिर स्क्रीन पर उसे चुनें।" : "For an additional DualSense, use an already paired controller to open Settings > Accessories > General > Bluetooth Accessories. Hold Create and PS on the new controller until its light blinks, then select it on screen.")
    ];

    if (has(playstation) && /\b(?:turn|switch|power|start|on|chalu)\b|चालू|शुरू/u.test(text)) return [
        makeStep(hi ? "बिजली का कनेक्शन जाँचें" : "Check the power connection", hi ? "देखें कि PS5 की पावर केबल कंसोल और काम कर रहे सॉकेट में ठीक से लगी है।" : "Check that the PS5 power cable is firmly connected to the console and a working outlet."),
        makeStep(hi ? "पावर बटन ढूँढें" : "Locate the power button", hi ? "कंसोल के सामने वाले किनारे पर power निशान या बटन देखें। जगह मॉडल के अनुसार थोड़ी अलग हो सकती है; eject बटन से भ्रमित न हों।" : "Look for the power-marked button along the front edge of the console. Its position can vary slightly by model; avoid confusing it with eject."),
        makeStep(hi ? "कंसोल चालू करें" : "Turn on the console", hi ? "पावर बटन एक बार दबाएँ। कंसोल की लाइट जलनी या बदलनी चाहिए।" : "Press the power button once. The console light should turn on or change."),
        makeStep(hi ? "शुरू होने दें" : "Wait for startup", hi ? "कंसोल को शुरू होने दें। अगर टीवी पर चित्र न दिखे, तो टीवी पर PS5 से जुड़ा HDMI input चुनें।" : "Allow the console to start. If the TV shows no picture, select the HDMI input connected to the PS5.")
    ];

    const displayConnectionAction = /\b(?:connect|mirror|display|show|cast|screen|hdmi|wireless)\b|जोड़|दिखा|कनेक्ट|कास्ट/u;
    if (has(laptop) && has(tv) && displayConnectionAction.test(text)) return [
        makeStep(hi ? "कनेक्शन का तरीका चुनें" : "Choose a connection method", hi ? "HDMI केबल सबसे सीधा तरीका है। Wireless display/AirPlay तभी चुनें जब लैपटॉप और टीवी दोनों उस सुविधा का समर्थन करते हों; हर टीवी smart TV नहीं होता।" : "An HDMI cable is the most direct option. Use wireless display or AirPlay only if both devices support it; not every TV is a smart TV."),
        makeStep(hi ? "केबल या समर्थित wireless विकल्प खोलें" : "Connect the cable or open a supported wireless option", hi ? "HDMI केबल दोनों उपकरणों के संगत पोर्ट में लगाएँ। Windows में समर्थित display के लिए Win+K दबाएँ; Mac पर उपलब्ध Display/AirPlay विकल्प देखें।" : "Connect an HDMI cable to compatible ports on both devices. On Windows, press Win+K for a supported display; on Mac, check Display or AirPlay options."),
        makeStep(hi ? "टीवी का input चुनें" : "Select the TV input", hi ? "टीवी के remote या physical controls से Input/Source खोलें और जुड़े HDMI पोर्ट या दिखाई दिए wireless display को चुनें। बटन और नाम model के अनुसार बदलते हैं।" : "Use the TV remote or physical controls to open Input/Source and choose the connected HDMI port or listed wireless display. Button names vary by model."),
        makeStep(hi ? "चित्र जाँचें" : "Check the picture", hi ? "लैपटॉप की स्क्रीन टीवी पर दिखनी चाहिए। न दिखे तो केबल, चुना input और दोनों उपकरणों की display सहायता जाँचें।" : "The laptop screen should appear on the TV. If not, check the cable, selected input, and display support on both devices.")
    ];

    if (has(phone) && has(tv) && displayConnectionAction.test(text)) return [
        makeStep(hi ? "दोनों उपकरणों के विकल्प जाँचें" : "Check both devices' supported options", hi ? "हर फोन टीवी पर wireless casting नहीं कर सकता। फोन और टीवी में समान cast सुविधा हो तभी wireless तरीका अपनाएँ; नहीं तो संगत HDMI adapter या streaming device की जरूरत हो सकती है।" : "Not every phone can cast to every TV. Use wireless casting only when both support the same feature; otherwise a compatible HDMI adapter or streaming device may be required."),
        makeStep(hi ? "टीवी पर सही source चुनें" : "Choose the correct TV source", hi ? "केबल या streaming device लगा रहे हैं तो TV के remote या physical controls से Input/Source खोलकर सही HDMI port चुनें।" : "If using a cable or streaming device, use the TV remote or physical controls to open Input/Source and select the connected HDMI port."),
        makeStep(hi ? "फोन पर समर्थित cast विकल्प खोलें" : "Open a supported casting option on the phone", hi ? "फोन के Quick Settings या Display में Cast/Screen Mirroring खोजें। नाम Android और iPhone में अलग हैं; विकल्प न मिले तो फोन model की official help देखें।" : "Look for Cast or Screen Mirroring in Quick Settings or Display. Labels differ between Android and iPhone; consult official help for your phone model if missing."),
        makeStep(hi ? "दिखाई दिए टीवी को चुनें" : "Select the TV shown", hi ? "सूची में अपना टीवी दिखे तभी उसे चुनें और स्क्रीन पर दिए निर्देश मानें। न दिखे तो दोनों उपकरणों की सुविधा और network requirements जाँचें।" : "Select your TV only if it appears in the list, then follow the on-screen prompts. If it does not appear, check feature support and network requirements on both devices.")
    ];

    const tvPowerOff = /\b(?:turn\s+off|switch\s+off|power\s+off|shut\s+off|off\s+kar(?:na|ni|do|o)|band\s+kar(?:na|ni|do|o))\b|बंद\s*(?:कर|करो|करना|करनी|करें)/u.test(text);
    const tvNotStarting = /\b(?:not\s+working|won.t\s+start|doesn.t\s+start|not\s+turning\s+on|no\s+display|problem|issue|trouble)\b|\b(?:nahi|nahin)\s*(?:chal|shuru|ho)\b|नहीं\s*(?:चल|शुरू|हो)|नही\s*(?:चल|शुरू|हो)|नहीं\s*हो\s*रहा|नही\s*हो\s*रहा/u.test(text);
    const tvInputChange = /\b(?:hdmi\s+)?(?:input|source)\b|\bhdmi\b|इनपुट|सोर्स/u.test(text) && /\b(?:change|switch|select|choose|set|find|open|use)\b|बदल|चुन|सेलेक्ट|खोल|कैसे/u.test(text);
    if ((has(tv) || has(/\bhdmi\b/u)) && tvInputChange) return [
        makeStep(hi ? "टीवी के Input/Source नियंत्रण को ढूँढें" : "Find the TV Input/Source control", hi ? "Remote पर Input, Source या HDMI नाम का बटन देखें। remote अलग हो तो TV के किनारे या नीचे physical buttons/joystick में यही विकल्प खोजें।" : "Look for an Input, Source, or HDMI button on the remote. If the remote differs, check the TV's side or underside physical buttons/joystick for the same option."),
        makeStep(hi ? "स्रोत सूची खोलें" : "Open the source list", hi ? "Input/Source बटन दबाएँ। कुछ remotes में Home मेन्यू खोलकर Inputs चुनना पड़ता है।" : "Press Input/Source. Some remotes require opening Home and choosing Inputs instead."),
        makeStep(hi ? "जुड़ा हुआ HDMI पोर्ट चुनें" : "Choose the connected HDMI port", hi ? "सूची में HDMI 1, HDMI 2 जैसे विकल्प दिखें तो वही चुनें जिसमें device की केबल लगी है। सही port का label TV model के अनुसार अलग हो सकता है।" : "Choose HDMI 1, HDMI 2, or the entry matching the port where the device cable is connected. Labels vary by TV model."),
        makeStep(hi ? "दिखाई दे रही स्क्रीन जाँचें" : "Check the displayed picture", hi ? "सही source पर device की स्क्रीन दिखनी चाहिए। No signal आए तो cable दोनों सिरों पर जाँचें और device चालू है या नहीं देखें।" : "The connected device should appear on the selected source. If you see No signal, check both ends of the cable and make sure the device is on.")
    ];
    if (has(tv) && tvNotStarting) return [
        makeStep(hi ? "बिजली का connection जाँचें" : "Check the power connection", hi ? "टीवी की power cable और socket ठीक से जुड़े हों। दूसरे उपकरण से socket काम करता है या नहीं जाँचें; गीले हाथ से plug न छुएँ।" : "Check that the TV power cable is firmly connected and the outlet works with another device. Do not handle plugs with wet hands."),
        makeStep(hi ? "Power light देखें" : "Check the power indicator", hi ? "टीवी की standby light जल रही है या नहीं देखें। light न हो तो outlet, cable और wall switch जाँचें; casing न खोलें।" : "Check whether the standby light is on. If not, check the outlet, cable, and wall switch; do not open the TV casing."),
        makeStep(hi ? "Remote या physical button आज़माएँ" : "Try the remote or physical button", hi ? "Remote की batteries जाँचें और power button एक बार दबाएँ। काम न करे तो TV के किनारे या नीचे physical power button/joystick देखें; जगह model के अनुसार बदलती है।" : "Check the remote batteries and press Power once. If that does not work, look for a physical power button or joystick on the side or underside; placement varies by model."),
        makeStep(hi ? "Input जाँचें" : "Check the input", hi ? "टीवी चालू हो पर picture न दिखे तो remote से Input/Source खोलकर सही HDMI port चुनें। फिर भी न चले तो model की official support देखें।" : "If the TV powers on but shows no picture, open Input/Source and select the correct HDMI port. If it still fails, consult official support for the model.")
    ];
    if (has(tv) && /\b(?:turn|switch|power|start|on|off|chalu|band|kar(?:na|ni|u|o|do)|kaise)\b|चालू|शुरू|बंद|करना|करनी|करूँ|कैसे/u.test(text)) {
        if (tvPowerOff) return [
            makeStep(hi ? "चल रहा काम जाँचें" : "Check what is currently playing", hi ? "यदि कोई recording या update चल रहा हो तो पहले उसे पूरा होने दें। फिर remote या TV पर physical controls ढूँढें।" : "If a recording or update is in progress, let it finish first. Then locate the remote or the TV's physical controls."),
            makeStep(hi ? "Power बटन ढूँढें" : "Locate the Power button", hi ? "Remote पर Power निशान देखें। remote न हो तो TV के किनारे या नीचे button/joystick देखें; जगह model के अनुसार बदलती है।" : "Look for the Power symbol on the remote. Without it, check the TV's side or underside for a button/joystick; placement varies by model."),
            makeStep(hi ? "एक बार दबाएँ" : "Press it once", hi ? "Power बटन एक बार दबाएँ और standby light आने तक प्रतीक्षा करें। बार-बार दबाने की जरूरत नहीं।" : "Press Power once and wait for the standby light. Repeated presses are unnecessary."),
            makeStep(hi ? "Standby स्थिति जाँचें" : "Check standby status", hi ? "स्क्रीन बंद और standby light चालू हो तो टीवी बंद है। कुछ model में light का रंग अलग हो सकता है।" : "The TV is off when the screen goes dark and its standby indicator appears; indicator colors vary by model.")
        ];
        return [
            makeStep(hi ? "बिजली का connection जाँचें" : "Check the power connection", hi ? "देखें कि TV की cable काम कर रहे socket में ठीक से लगी है। remote और button के तरीके model के अनुसार बदल सकते हैं।" : "Check that the TV cable is firmly connected to a working outlet. Remote and button layouts vary by model."),
            makeStep(hi ? "Power नियंत्रण ढूँढें" : "Locate a power control", hi ? "Remote पर Power निशान देखें। remote न हो तो TV के सामने वाले किनारे, side या नीचे physical button/joystick ढूँढें।" : "Look for the Power symbol on the remote. Without it, check the front edge, side, or underside of the TV for a physical button or joystick."),
            makeStep(hi ? "Power एक बार दबाएँ" : "Press Power once", hi ? "Remote या TV का power button एक बार दबाएँ। बार-बार दबाने के बजाय कुछ क्षण प्रतीक्षा करें।" : "Press Power once on the remote or TV. Wait a moment instead of pressing repeatedly."),
            makeStep(hi ? "शुरू होने की पुष्टि करें" : "Check that it starts", hi ? "Power indicator या screen देखें। light न जले तो socket और cable फिर जाँचें। TV चालू हो पर picture न हो तो Input/Source से सही port चुनें।" : "Check the power indicator or screen. If the light stays off, recheck the outlet and cable. If the TV is on but blank, choose the right port using Input/Source.")
        ];
    }

    if (has(laptop) && /\b(?:headphones?|earbuds?|headset)\b|हेडफोन|ईयरबड/u.test(text) && /\b(?:bluetooth|connect|pair|wireless)\b|ब्लूटूथ|जोड़|कनेक्ट|पेयर/u.test(text)) return [
        makeStep(hi ? "हेडफोन को pairing mode में रखें" : "Put the headphones in pairing mode", hi ? "हेडफोन चालू करें और निर्माता के निर्देश से उन्हें discoverable/pairing mode में रखें। तरीका मॉडल के अनुसार बदलता है।" : "Turn on the headphones and use the manufacturer's instructions to make them discoverable or enter pairing mode. This varies by model."),
        makeStep(hi ? "लैपटॉप में Bluetooth खोलें" : "Open Bluetooth on the laptop", hi ? "Windows में Settings खोजकर Bluetooth खोलें। Mac पर Apple menu से System Settings > Bluetooth खोलें। नाम संस्करण के अनुसार बदल सकते हैं।" : "On Windows, search Settings for Bluetooth. On Mac, open Apple menu > System Settings > Bluetooth. Labels can vary by version."),
        makeStep(hi ? "उपकरण की सूची में हेडफोन चुनें" : "Select the headphones", hi ? "Bluetooth सूची में अपने हेडफोन का नाम चुनें और दिखाए गए निर्देश पूरे करें। एक जैसे नाम हों तो मॉडल जाँचें।" : "Choose your headphone name in the Bluetooth list and follow the displayed prompts. If names look alike, check the model."),
        makeStep(hi ? "कनेक्शन और आवाज़ जाँचें" : "Check the connection and audio", hi ? "Connected दिखने पर कम आवाज़ में ऑडियो चलाकर जाँचें। pairing code माँगा जाए तो केवल अपने हेडफोन और लैपटॉप की स्क्रीन पर जाँचें; किसी से साझा न करें।" : "When it shows Connected, test audio at low volume. If asked for a pairing code, check only the headphone and laptop screens; do not share it.")
    ];

    if (has(phone) && /\b(?:headphones?|earbuds?|headset)\b|हेडफोन|ईयरबड/u.test(text) && /\b(?:bluetooth|connect|pair)\b|ब्लूटूथ|जोड़/u.test(text)) return [
        makeStep(hi ? "हेडफोन पेयरिंग मोड में रखें" : "Put the headphones in pairing mode", hi ? "हेडफोन चालू करें और उनके निर्माता के निर्देश के अनुसार pairing mode चालू करें। बटन का तरीका मॉडल के अनुसार बदलता है।" : "Turn on the headphones and use their manufacturer’s instructions to enter pairing mode. Button steps vary by model."),
        makeStep(hi ? "फोन की Bluetooth सेटिंग खोलें" : "Open Bluetooth settings on the phone", hi ? "फोन की Settings में Bluetooth खोजें। मेन्यू का नाम फोन और सॉफ़्टवेयर संस्करण के अनुसार बदल सकता है।" : "Search for Bluetooth in the phone’s Settings. Menu labels vary by phone and software version."),
        makeStep(hi ? "हेडफोन चुनें" : "Select the headphones", hi ? "उपलब्ध उपकरणों की सूची में अपने हेडफोन का नाम चुनें। अगर कई समान नाम दिखें, तो अपने मॉडल का नाम जाँचें।" : "Choose your headphone name from available devices. If several similar names appear, check the model name."),
        makeStep(hi ? "कनेक्शन जाँचें" : "Check the connection", hi ? "Connected दिखने पर कम आवाज़ में ऑडियो चलाकर जाँचें। किसी अज्ञात pairing code को साझा न करें।" : "When it shows Connected, test audio at a low volume. Do not share an unexpected pairing code.")
    ];

    const institutionPortal = /\b(?:college|student|university|school)\s+portal\b|कॉलेज\s*पोर्टल|छात्र\s*पोर्टल|विश्वविद्यालय\s*पोर्टल/u.test(text);
    if (institutionPortal && /\b(?:password|passcode)\b|पासवर्ड/u.test(text) && /\b(?:change|update|reset|forgot|recover)\b|बदल|रीसेट/u.test(text)) return [
        makeStep(hi ? "पहचान और पासवर्ड सुरक्षित रखें" : "Protect your credentials", hi ? "यह सुरक्षा बदलाव है। केवल अपने कॉलेज के आधिकारिक portal पते का उपयोग करें और अपना वर्तमान पासवर्ड या OTP किसी को न बताएँ।" : "This may affect account security. Use only your college’s official portal address; never share your current password or a one-time code."),
        makeStep(hi ? "आधिकारिक portal खोलें" : "Open the official portal", hi ? "अपने कॉलेज का जाना-पहचाना student portal खोलें। संदेश में आए अनजान लिंक से sign in न करें।" : "Open your college’s known student portal. Do not sign in through an unfamiliar link in a message."),
        makeStep(hi ? "Password विकल्प खोजें" : "Find the password option", hi ? "Profile, Account या Security जैसे क्षेत्र में password बदलने का विकल्प खोजें। नाम हर portal में अलग हो सकता है। प्रवेश न हो तो केवल उसी portal का Forgot password विकल्प इस्तेमाल करें।" : "Look for a password option under an area such as Profile, Account, or Security; labels vary by portal. If you cannot sign in, use that portal’s Forgot password option."),
        makeStep(hi ? "मजबूत पासवर्ड चुनें" : "Choose a strong password", hi ? "एक अलग, मजबूत पासवर्ड बनाएँ। उसे Raasta या किसी व्यक्ति को न भेजें; recovery code भी निजी रखें।" : "Choose a strong, unique password. Do not send it to Raasta or anyone else; keep recovery codes private."),
        makeStep(hi ? "साझा कंप्यूटर से sign out करें" : "Sign out on shared computers", hi ? "यदि साझा कंप्यूटर इस्तेमाल किया है तो sign out करें और browser में password save न करें।" : "If you used a shared computer, sign out and do not save the password in that browser.")
    ];

    if (/\b(?:exam|examination|result|marks)\b|परीक्षा|रिजल्ट|परिणाम|अंक/u.test(text) && /\b(?:check|view|find|see|look|result)\b|देख|जाँच/u.test(text)) return [
        makeStep(hi ? "आधिकारिक वेबसाइट खोलें" : "Open the official website", hi ? "अपने school या college की आधिकारिक वेबसाइट या saved portal link खोलें। खोज परिणाम में विज्ञापन से सावधान रहें।" : "Open your school or college’s official website or saved portal link. Be careful with sponsored search results."),
        makeStep(hi ? "छात्र portal में sign in करें" : "Sign in to the student portal", hi ? "अपने credentials स्वयं दर्ज करें। Password या OTP Raasta या किसी अनजान व्यक्ति को न भेजें।" : "Enter your credentials yourself. Never send Raasta or an unfamiliar person your password or one-time code."),
        makeStep(hi ? "Examination या Results क्षेत्र खोजें" : "Find Examination or Results", hi ? "Examination, Academics या Results जैसा क्षेत्र देखें। मेन्यू का नाम portal के अनुसार बदल सकता है।" : "Look for an area such as Examination, Academics, or Results. Menu labels vary by portal."),
        makeStep(hi ? "सही परीक्षा चुनें" : "Choose the right exam", hi ? "यदि विकल्प हों तो सही semester या परीक्षा चुनें और portal पर दिखा परिणाम पढ़ें। Raasta आपका वास्तविक परिणाम नहीं देख सकता।" : "If offered, choose the correct semester or exam and read the result shown by the portal. Raasta cannot see your actual result.")
    ];

    if (/\b(?:wifi|wi[ -]?fi|wireless)\b|वाई[ -]?फाई|वाईफाई/u.test(text) && /\b(?:troubleshoot(?:ing)?|trouble|fix|problem|issue|not\s+working|doesn.t\s+connect)\b|समस्या|काम\s*नहीं|जुड़\s*नहीं/u.test(text)) return [
        makeStep(hi ? "Wi-Fi और Airplane mode जाँचें" : "Check Wi-Fi and Airplane mode", hi ? "अपने उपकरण में Wi-Fi चालू और Airplane mode बंद है या नहीं देखें।" : "On your device, check that Wi-Fi is on and Airplane mode is off."),
        makeStep(hi ? "नेटवर्क जाँचें" : "Check the network", hi ? "पुष्टि करें कि आप सही नेटवर्क से जुड़े हैं। router की lights देखें और पूछें कि दूसरे उपकरणों पर इंटरनेट चल रहा है या नहीं।" : "Confirm you chose the right network. Check the router lights and ask whether other devices can reach the internet."),
        makeStep(hi ? "सुरक्षित तरीके से फिर जुड़ें" : "Reconnect safely", hi ? "यदि नेटवर्क आपका है और पासवर्ड मालूम है, तभी disconnect करके दोबारा connect करें। router reset करने से पहले उसके मालिक से पूछें।" : "Only disconnect and reconnect if it is your network and you know its password. Ask the network owner before resetting a router."),
        makeStep(hi ? "त्रुटि का संदेश देखें" : "Check for an error", hi ? "फिर भी समस्या हो तो स्क्रीन पर दिखा error note करें और अपने network administrator या internet provider से मदद लें।" : "If it still fails, note the error shown and ask your network administrator or internet provider for help.")
    ];

    if (has(phone) && /\bhotspot\b|हॉटस्पॉट/u.test(text) && /\b(?:turn|enable|start|on|chalu)\b|चालू|करना/u.test(text)) return [
        makeStep(hi ? "Hotspot विकल्प ढूँढें" : "Find the hotspot option", hi ? "फोन की Settings में search का उपयोग करके Hotspot या Personal Hotspot खोजें। नाम Android और iPhone में अलग हो सकता है।" : "Use Settings search to find Hotspot or Personal Hotspot. The label differs between Android and iPhone."),
        makeStep(hi ? "पासवर्ड और नेटवर्क जाँचें" : "Check the password and network", hi ? "Hotspot चालू करने से पहले मजबूत पासवर्ड और मोबाइल डेटा की स्थिति जाँचें। पासवर्ड किसी अनजान व्यक्ति को न दें; डेटा शुल्क लग सकता है।" : "Before enabling it, check the password and mobile-data status. Do not share the password with strangers; data charges may apply."),
        makeStep(hi ? "Hotspot चालू करें" : "Turn on the hotspot", hi ? "Hotspot/P​​ersonal Hotspot स्विच चालू करें। आपके फोन के संस्करण में विकल्प का स्थान अलग हो सकता है।" : "Turn on the Hotspot/Personal Hotspot switch. Its location varies by phone version."),
        makeStep(hi ? "दूसरे उपकरण से जाँचें" : "Check from the other device", hi ? "दूसरे उपकरण पर Wi-Fi सूची खोलकर अपने फोन का नेटवर्क चुनें और सुरक्षित पासवर्ड दर्ज करें।" : "On the other device, open the Wi-Fi list, choose your phone’s network, and enter the password privately.")
    ];

    if (has(laptop) && /\b(?:wifi|wi[ -]?fi|wireless)\b|वाई[ -]?फाई|वाईफाई/u.test(text)) return [
        makeStep(hi ? "Wi-Fi चालू है या नहीं देखें" : "Check that Wi-Fi is on", hi ? "लैपटॉप के network settings में Wi-Fi चालू होना चाहिए। Airplane mode भी बंद होना चाहिए।" : "In the laptop’s network settings, make sure Wi-Fi is on and Airplane mode is off."),
        makeStep(hi ? "सही नेटवर्क चुनें" : "Choose the right network", hi ? "दिखाई गई नेटवर्क सूची में अपना जाना-पहचाना नेटवर्क चुनें। सार्वजनिक या अनजान नेटवर्क पर निजी जानकारी न भेजें।" : "Choose your known network from the list. Avoid sending private information over public or unfamiliar networks."),
        makeStep(hi ? "पासवर्ड दर्ज करें" : "Enter the password", hi ? "नेटवर्क का पासवर्ड स्वयं दर्ज करें; इसे यहाँ या किसी चैट में साझा न करें।" : "Enter the network password yourself; do not share it here or in a chat."),
        makeStep(hi ? "कनेक्शन जाँचें" : "Check the connection", hi ? "Connected दिखने पर कोई भरोसेमंद वेबसाइट खोलें। न जुड़े तो password दोबारा जाँचें और router को restart करने से पहले मालिक से पूछें।" : "When it shows Connected, open a trusted website. If it fails, recheck the password and ask the network owner before restarting the router.")
    ];

    if (/\b(?:screenshot|screen\s*shot|capture\s+(?:the\s+)?screen)\b|स्क्रीनशॉट/u.test(text) && has(/\b(?:windows|laptop|computer|pc)\b|विंडोज़?|लैपटॉप|कंप्यूटर/u)) return [
        makeStep(hi ? "सही स्क्रीन खोलें" : "Show the screen you need", hi ? "जिस विंडो या हिस्से का screenshot चाहिए उसे स्क्रीन पर खोलें। निजी जानकारी हो तो पहले छिपाएँ।" : "Bring the window or area you want to capture onto the screen. Hide private information first."),
        makeStep(hi ? "स्क्रीनशॉट टूल खोलें" : "Open the screenshot tool", hi ? "Windows में Windows+Shift+S दबाएँ। कुछ संस्करणों में Snipping Tool भी Start मेन्यू में मिलता है।" : "On Windows, press Windows+Shift+S. Some versions also provide Snipping Tool from Start."),
        makeStep(hi ? "हिस्सा चुनें" : "Select an area", hi ? "दिखाई दिए विकल्प से स्क्रीन का हिस्सा या पूरी विंडो चुनें।" : "Choose a screen area or full window from the options shown."),
        makeStep(hi ? "चित्र सहेजें" : "Save the image", hi ? "Snipping Tool खुलने पर Save as से कॉपी सहेजें। कुछ Windows संस्करण screenshot को अपने-आप Screenshots folder में रखते हैं। जरूरत हो तो clipboard से भी paste करें।" : "When Snipping Tool opens, use Save as to save a copy. Some Windows versions automatically save snips in the Screenshots folder. You can also paste from the clipboard.")
    ];

    if (has(/\b(?:ps5|playstation|console)\b|प्लेस्टेशन|पीएस\s*5/u) && has(/\b(?:turn|switch|power|start|on|chalu)\b|चालू|शुरू/u)) return null;

    if (/\b(?:gmail|google\s+account)\b|जीमेल|गूगल\s*अकाउंट/u.test(text) && /\b(?:create|make|new|account|banana|banao|banau)\b|बनाना|बनाओ/u.test(text)) return [
        makeStep(hi ? "आधिकारिक signup पेज खोलें" : "Open the official sign-up page", hi ? "ब्राउज़र में accounts.google.com खोलें और Create account चुनें। किसी विज्ञापन या अनजान लिंक के बजाय पता स्वयं टाइप करें।" : "Open accounts.google.com in your browser and choose Create account. Type the address yourself instead of using an unfamiliar link."),
        makeStep(hi ? "खाता विवरण भरें" : "Enter the account details", hi ? "पेज नाम और जन्मतिथि जैसी जानकारी पूछ सकता है। उपलब्ध Gmail नाम चुनें, मजबूत पासवर्ड स्वयं भरें और verification केवल Google के आधिकारिक पेज पर करें।" : "The form may ask for details such as your name and birth date. Choose an available Gmail address, enter a strong password yourself, and verify only on Google's official page."),
        makeStep(hi ? "खाता सुरक्षित करें" : "Secure the account", hi ? "मजबूत, अलग पासवर्ड बनाएँ और recovery विकल्प जोड़ें। पेज जो verification माँगे, उसे केवल आधिकारिक Google पेज पर पूरा करें।" : "Create a strong, unique password and add recovery options. Complete any verification only on the official Google page."),
        makeStep(hi ? "खाता जाँचें" : "Check the account", hi ? "खाता बनने पर sign-in करके देखें और recovery जानकारी सुरक्षित रखें।" : "After creation, sign in to check the account and keep recovery details safe.")
    ];

    if (/\b(?:install|download)\b|इंस्टॉल|डाउनलोड/u.test(text) && /\b(?:app|application|software)\b|ऐप|सॉफ़्टवेयर/u.test(text) && has(laptop)) {
        return [
            makeStep(hi ? "आधिकारिक स्रोत पहचानें" : "Identify the official source", hi ? "ऐप की आधिकारिक वेबसाइट या अपने operating system के आधिकारिक app store का उपयोग करें। अनजान download साइटों से बचें।" : "Use the app’s official website or your operating system’s official app store. Avoid unfamiliar download sites."),
            makeStep(hi ? "संगतता जाँचें" : "Check compatibility", hi ? "ऐप के system requirements अपने Windows या macOS संस्करण से मिलाएँ।" : "Compare the app’s system requirements with your Windows or macOS version."),
            makeStep(hi ? "इंस्टॉलर चलाएँ" : "Run the installer", hi ? "डाउनलोड की गई फ़ाइल का नाम और स्रोत जाँचें, फिर स्क्रीन पर दिए निर्देश पढ़कर आगे बढ़ें। अनुमति माँगने वाले prompt को ध्यान से जाँचें।" : "Check the downloaded file name and source, then follow the displayed instructions. Review any permission prompt carefully."),
            makeStep(hi ? "ऐप खोलकर जाँचें" : "Open and check the app", hi ? "इंस्टॉल पूरा होने पर ऐप खोलें। कोई समस्या हो तो ऐप की आधिकारिक सहायता देखें।" : "Open the app after installation. If anything looks wrong, consult the app’s official help.")
        ];
    }

    const platform = detectPlatform(text);
    if (/\b(?:location|gps)\b|लोकेशन|स्थान/u.test(text) && /\b(?:turn|enable|on|allow|location|chalu)\b|चालू|अनुमति/u.test(text) && platform) return [
        makeStep(hi ? "अनुमति का असर समझें" : "Review the privacy impact", hi ? "Location सेवा आपकी जगह बता सकती है। केवल जरूरत वाले ऐप को अनुमति दें और password या निजी जानकारी साझा न करें।" : "Location can reveal where you are. Allow it only for apps that need it, and never share passwords or private information."),
        makeStep(hi ? "Settings में Location खोजें" : "Search Settings for Location", hi ? `अपने ${platform} उपकरण की Settings में search करके Location विकल्प खोलें। नाम और जगह संस्करण के अनुसार बदल सकते हैं।` : `In ${platform} Settings, search for Location and open the relevant option. Names and locations vary by version.`),
        makeStep(hi ? "सेवा और ऐप अनुमति चुनें" : "Choose service and app permissions", hi ? "Location सेवा चालू करें तभी जब आपको इसकी जरूरत हो। हर ऐप के लिए अलग अनुमति जाँचें; विकल्प न दिखें तो अपने मॉडल की आधिकारिक मदद देखें।" : "Turn the service on only if you need it. Review permissions for each app; if the option is missing, consult official help for your model."),
        makeStep(hi ? "ज़रूरत पूरी होने पर फिर जाँचें" : "Review the setting later", hi ? "देखें कि केवल भरोसेमंद और जरूरी ऐप को ही अनुमति मिली है। जरूरत न हो तो Location बंद कर सकते हैं।" : "Check that only trusted, necessary apps have access. Turn Location off when you no longer need it.")
    ];
    if (/\b(?:location|gps)\b|लोकेशन|स्थान/u.test(text) && /\b(?:turn|enable|on|allow|location|chalu)\b|चालू|अनुमति/u.test(text)) return null;
    if (/\b(?:wifi|wi[ -]?fi|wireless)\b|वाई[ -]?फाई|वाईफाई/u.test(text) && /\b(?:password|change|update|reset|router)\b|पासवर्ड|बदल/u.test(text)) return null;
    return undefined;
}

export function classifyUniversalRequest(task) {
    if (typeof task !== "string") return { digital: false, guide: null };
    const text = normalizeUniversalTranscript(task).replace(/[’']/g, "'");
    if (contains(text, disallowedIntent) || !isDigitalRequest(text)) return { digital: false, guide: null };
    const guide = localSteps(text, false);
    if (guide === null) return { digital: true, guide: null, clarification: true };
    if (Array.isArray(guide)) return { digital: true, guide };
    return { digital: true, guide: null, clarification: true };
}

export function createLocalUniversalPlan(task, language = "en", mode = "fallback") {
    const isHindi = language === "hi";
    const text = normalizeUniversalTranscript(task).replace(/[’']/g, "'");
    if (contains(text, disallowedIntent) || !isDigitalRequest(text)) return null;
    if (contains(text, destructiveTask)) {
        return {
            task: String(task).trim().slice(0, 160), category: "unsupported", language,
            instruction: "", steps: [],
            clarifyingQuestion: isHindi
                ? "यह काम डेटा मिटा सकता है। क्या आप सच में फ़ैक्टरी रीसेट करना चाहते हैं? पहले बैकअप और अपने मॉडल के आधिकारिक निर्देश की पुष्टि करें।"
                : "This could erase your data. Are you sure you intend a factory reset? First confirm your backup and the official instructions for your model.",
            supported: false, mode
        };
    }
    const steps = localSteps(text, isHindi);
    if (Array.isArray(steps)) {
        const safetyFlag = /\b(?:password|security|delete|erase|reset|purchase|pay|payment|billing|location)\b|पासवर्ड|सुरक्षा|हटाना|मिटाना|रीसेट|खरीद|भुगतान|लोकेशन/u.test(text);
        if (safetyFlag && !/\b(?:may affect|risk|before (?:you|continuing|changing)|first (?:confirm|verify)|caution|warning|never share|do not share|reveal|expose)\b|प्रभावित|जोखिम|आगे बढ़ने से पहले|पहले पुष्टि|सावधानी|साझा न करें|जगह बता सकती/i.test(steps[0]?.instruction || "")) {
            steps.unshift(makeStep(isHindi ? "पहले सुरक्षा जाँचें" : "Check the impact first", isHindi ? "यह काम सुरक्षा, गोपनीयता या खर्च को प्रभावित कर सकता है। आगे बढ़ने से पहले अपने उपकरण और आधिकारिक निर्देश की पुष्टि करें; password या निजी जानकारी साझा न करें।" : "This task may affect security, privacy, or cost. Confirm your device and official instructions before continuing; do not share passwords or private information."));
        }
        return {
            task: String(task).trim().slice(0, 160), category: "universal_guidance", language,
            device: detectDevice(text), platform: detectPlatform(text),
            instruction: isHindi ? "नीचे सामान्य मार्गदर्शन है। उपकरण के मॉडल के अनुसार नाम या स्थान अलग हो सकते हैं।" : "General guidance follows. Names and locations may vary by device model.",
            steps: steps.slice(0, 8).map(step => ({ title: step.title, instruction: step.instruction })),
            clarifyingQuestion: "", supported: true, mode
        };
    }
    const device = detectDevice(text);
    const platform = detectPlatform(text);
    if (/\b(?:phone|smartphone|mobile)\b|फोन|मोबाइल/u.test(text) && /\bsettings?\b|सेटिंग/u.test(text) && /\b(?:not\s+working|problem|issue|help)\b|काम\s*नहीं|समस्या/u.test(text)) {
        return { task: String(task).trim().slice(0, 160), category: "unsupported", language, instruction: "", steps: [], supported: false, mode,
            clarifyingQuestion: isHindi ? "फोन में कौन-सी सेटिंग काम नहीं कर रही—Wi-Fi, brightness या Bluetooth? स्क्रीन पर क्या दिखता है?" : "Which phone setting is not working—Wi-Fi, brightness, or Bluetooth? What do you see on screen?" };
    }
    const wifiPasswordChange = /\b(?:wifi|wi[ -]?fi|wireless)\b|वाई[ -]?फाई|वाईफाई/u.test(text) && /\b(?:password|change|update|reset|router)\b|पासवर्ड|बदल/u.test(text);
    const browserSettings = /\b(?:browser|chrome|firefox|edge|safari)\b|ब्राउज़र|क्रोम/u.test(text) && /\b(?:settings?|preferences|options)\b|सेटिंग/u.test(text);
    const needsPlatform = /\b(?:install|app|application|software|location|gps|wifi|wi[ -]?fi|wireless)\b|इंस्टॉल|ऐप|लोकेशन|वाई[ -]?फाई|वाईफाई/u.test(text) && !platform;
    const question = isHindi
        ? (browserSettings ? "आप कौन-सा browser इस्तेमाल करते हैं, और कौन-सी setting बदलना चाहते हैं—privacy, downloads या कुछ और?" : wifiPasswordChange ? "क्या आप router का Wi-Fi password बदलना चाहते हैं या अपने उपकरण में सहेजा password? Router का मॉडल भी बताएँ; नया password किसी से साझा न करें।" : needsPlatform ? "आप किस उपकरण और सिस्टम का उपयोग कर रहे हैं—Android, iPhone, Windows या Mac?" : "आप कौन-सा उपकरण या मॉडल इस्तेमाल कर रहे हैं, और स्क्रीन पर अभी क्या दिख रहा है?")
        : (browserSettings ? "Which browser are you using, and which setting do you want to change—for example, privacy or downloads?" : wifiPasswordChange ? "Are you changing the router's Wi-Fi password or the saved password on your device? What router model do you have? Keep the new password private." : needsPlatform ? "Which device and system are you using—Android, iPhone, Windows, or Mac?" : "Which device or model are you using, and what do you see on screen now?");
    return {
        task: String(task).trim().slice(0, 160), category: "unsupported", language,
        instruction: "", steps: [], clarifyingQuestion: question, supported: false, mode
    };
}

function detectDevice(text) {
    if (/\b(?:college|student|university|school)\s+portal\b|कॉलेज\s*पोर्टल|छात्र\s*पोर्टल|विश्वविद्यालय\s*पोर्टल/u.test(text)) return "student portal";
    if (/\b(?:exam|examination|result)\b|परीक्षा|रिजल्ट|परिणाम/u.test(text)) return "school or college portal";
    if (/\b(?:browser|chrome|firefox|edge|safari)\b|ब्राउज़र|क्रोम/u.test(text)) return "browser";
    if (/\b(?:ps5|playstation|console)\b|प्लेस्टेशन|पीएस\s*5/u.test(text)) return "PlayStation 5";
    if (/\b(?:laptop|computer|pc|windows|mac(?:book)?)\b|लैपटॉप|कंप्यूटर|विंडोज़?|मैकबुक?/u.test(text)) return "computer";
    if (/\b(?:phone|smartphone|mobile|android|iphone|ios)\b|फोन|मोबाइल|एंड्रॉयड|आईफोन/u.test(text)) return "phone";
    if (/\b(?:tv|television)\b|टीवी|टेलीविज़न/u.test(text)) return "TV";
    if (/\bhdmi\b/u.test(text)) return "TV";
    if (/\brouter\b|राउटर/u.test(text)) return "router";
    return "digital device";
}

function detectPlatform(text) {
    if (/\bwindows\b|विंडोज़?/u.test(text)) return "Windows";
    if (/\b(?:mac|macbook|macos)\b|मैकबुक?|मैकोएस/u.test(text)) return "macOS";
    if (/\bandroid\b|एंड्रॉयड/u.test(text)) return "Android";
    if (/\b(?:iphone|ios)\b|आईफोन/u.test(text)) return "iOS";
    if (/\bps5\b|प्लेस्टेशन|पीएस\s*5/u.test(text)) return "PlayStation 5";
    return "";
}
