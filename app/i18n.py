"""Fixed phrases for read-backs, alerts and customer messages.

Ask a native speaker on the team to check each language before the demo.
Money placeholders ({amount}, {balance}, {total}, {sales}, {given},
{collected}) take whole rupees and are formatted here: "₹1,240" on screen,
"1240 ரூபாய்" when spoken.
"""

LANGUAGES = {
    "hi-IN": "Hindi",
    "kn-IN": "Kannada",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "en-IN": "English",
}

RUPEE_WORD = {"hi-IN": "रुपये", "kn-IN": "ರೂಪಾಯಿ", "ta-IN": "ரூபாய்", "te-IN": "రూపాయలు", "en-IN": "rupees"}
CASH_SUFFIX = {"hi-IN": " नकद", "kn-IN": " ನಗದು", "ta-IN": " ரொக்கமாக", "te-IN": " నగదుగా", "en-IN": " in cash"}
MONEY_KEYS = {"amount", "balance", "total", "limit", "sales", "given", "collected"}

# ------------------------------------------------------------------ to the merchant
MERCHANT = {
    "en-IN": {
        "confirm_credit": "{name}, {amount} udhaar{items}. Save?",
        "confirm_new_credit": "{name} is a new customer. {amount} udhaar{items}. Add and save?",
        "confirm_repayment": "{name} paid {amount}{mode}. Save?",
        "confirm_cash_sale": "Cash sale {amount}. Save?",
        "confirm_request": "Send {name} a payment link for {amount}?",
        "which_customer": "Which {name}? {options}",
        "saved": "Saved.",
        "saved_balance": "Saved. {name} now owes {balance}.",
        "saved_clear": "Saved. {name} has no dues.",
        "request_sent": "Payment link sent to {name}.",
        "cancelled": "Cancelled. Nothing was saved.",
        "not_understood": "I didn't catch that. Please say it again.",
        "nothing_pending": "There's nothing waiting to be saved.",
        "unknown_customer": "I couldn't find {name} in your khata.",
        "no_consent": "{name} hasn't agreed to WhatsApp messages yet.",
        "paid_left": "{name} paid {amount}. {balance} left.",
        "paid_clear": "{name} paid {amount}. Balance cleared.",
        "dispute_alert": "{name} says the {amount} entry is wrong.",
        "balance_flag_alert": '{name} says the pending amount ({amount}) is wrong. Reminders paused.',
        "joined": "{name} joined your khata.",
        "reminder_sent": "Reminder sent to {name} for {balance}.",
        "outstanding": "{count} customers owe {total}. Most: {top}.",
        "for_days": " for {days} days",
        "nobody": "Nobody owes you money right now.",
        "customer_balance": "{name} owes {balance}.",
        "customer_balance_days": "{name} owes {balance}, pending for {days} days.",
        "customer_clear": "{name} has no dues.",
        "confirm_undo_credit": "Remove {name}'s {amount} udhaar{items}?",
        "confirm_undo_repayment": "Remove the {amount} payment from {name}?",
        "undone": "Removed. {name} now owes {balance}.",
        "nothing_to_undo": "There's no entry from today to undo.",
        "undo_paid": "{name} has already paid for that udhaar, so it can't be removed.",
        "confirm_credit_over_limit": "{name}, {amount} udhaar{items}. Already owes {balance}; this makes {total}, over the {limit} limit. Save anyway?",
        "more_than_due": "{name} owes only {balance}, not {amount}. Please say the amount again.",
        "today_summary": "Today: cash sales {sales}, udhaar given {given}, collected {collected}.",
    },
    "hi-IN": {
        "confirm_credit": "{name}, {amount} उधार{items}। सेव करूँ?",
        "confirm_new_credit": "{name} नए ग्राहक हैं। {amount} उधार{items}। जोड़कर सेव करूँ?",
        "confirm_repayment": "{name} ने {amount} दिए{mode}। सेव करूँ?",
        "confirm_cash_sale": "नकद बिक्री {amount}। सेव करूँ?",
        "confirm_request": "{name} को {amount} का पेमेंट लिंक भेजूँ?",
        "which_customer": "कौन से {name}? {options}",
        "saved": "सेव हो गया।",
        "saved_balance": "सेव हो गया। {name} का बकाया अब {balance} है।",
        "saved_clear": "सेव हो गया। {name} पर कोई बकाया नहीं।",
        "request_sent": "{name} को लिंक भेज दिया।",
        "cancelled": "रद्द कर दिया। कुछ सेव नहीं हुआ।",
        "not_understood": "समझ नहीं आया, कृपया फिर से बोलिए।",
        "nothing_pending": "अभी सेव करने के लिए कुछ नहीं है।",
        "unknown_customer": "{name} नाम का ग्राहक खाते में नहीं मिला।",
        "no_consent": "{name} ने अभी WhatsApp संदेशों की अनुमति नहीं दी है।",
        "paid_left": "{name} ने {amount} दिए। {balance} बाकी है।",
        "paid_clear": "{name} ने {amount} दिए। पूरा बकाया चुक गया।",
        "dispute_alert": "{name} कहते हैं कि {amount} की एंट्री गलत है।",
        "balance_flag_alert": '{name} कहते हैं कि बकाया राशि ({amount}) गलत है। रिमाइंडर रोक दिए गए।',
        "joined": "{name} आपके खाते से जुड़ गए।",
        "reminder_sent": "{name} को {balance} का रिमाइंडर भेजा।",
        "outstanding": "{count} ग्राहकों पर कुल {total} बकाया है। सबसे ज़्यादा: {top}।",
        "for_days": " ({days} दिन से)",
        "nobody": "अभी किसी पर कोई बकाया नहीं है।",
        "customer_balance": "{name} पर {balance} बकाया है।",
        "customer_balance_days": "{name} पर {balance} बकाया है, {days} दिन से।",
        "customer_clear": "{name} पर कोई बकाया नहीं है।",
        "confirm_undo_credit": "{name} का {amount} उधार{items} हटाऊँ?",
        "confirm_undo_repayment": "{name} का {amount} भुगतान हटाऊँ?",
        "undone": "हटा दिया। {name} का बकाया अब {balance} है।",
        "nothing_to_undo": "आज की कोई एंट्री हटाने को नहीं है।",
        "undo_paid": "{name} उस उधार का भुगतान कर चुके हैं, इसलिए इसे हटाया नहीं जा सकता।",
        "confirm_credit_over_limit": "{name}, {amount} उधार{items}। पहले से {balance} बाकी है; अब {total} होगा, जो {limit} की सीमा से ज़्यादा है। फिर भी सेव करूँ?",
        "more_than_due": "{name} पर सिर्फ़ {balance} बकाया है, {amount} नहीं। कृपया रकम फिर से बोलिए।",
        "today_summary": "आज: नकद बिक्री {sales}, उधार दिया {given}, वसूली {collected}।",
    },
    "kn-IN": {
        "confirm_credit": "{name}, {amount} ಸಾಲ{items}. ಉಳಿಸಲೇ?",
        "confirm_new_credit": "{name} ಹೊಸ ಗ್ರಾಹಕರು. {amount} ಸಾಲ{items}. ಸೇರಿಸಿ ಉಳಿಸಲೇ?",
        "confirm_repayment": "{name} {amount} ಕೊಟ್ಟರು{mode}. ಉಳಿಸಲೇ?",
        "confirm_cash_sale": "ನಗದು ಮಾರಾಟ {amount}. ಉಳಿಸಲೇ?",
        "confirm_request": "{name} ಅವರಿಗೆ {amount} ಪಾವತಿ ಲಿಂಕ್ ಕಳುಹಿಸಲೇ?",
        "which_customer": "ಯಾವ {name}? {options}",
        "saved": "ಉಳಿಸಲಾಗಿದೆ.",
        "saved_balance": "ಉಳಿಸಲಾಗಿದೆ. {name} ಈಗ {balance} ಕೊಡಬೇಕು.",
        "saved_clear": "ಉಳಿಸಲಾಗಿದೆ. {name} ಅವರಿಗೆ ಬಾಕಿ ಇಲ್ಲ.",
        "request_sent": "{name} ಅವರಿಗೆ ಲಿಂಕ್ ಕಳುಹಿಸಲಾಗಿದೆ.",
        "cancelled": "ರದ್ದು ಮಾಡಲಾಗಿದೆ. ಏನನ್ನೂ ಉಳಿಸಿಲ್ಲ.",
        "not_understood": "ಅರ್ಥವಾಗಲಿಲ್ಲ, ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.",
        "nothing_pending": "ಉಳಿಸಲು ಏನೂ ಬಾಕಿ ಇಲ್ಲ.",
        "unknown_customer": "{name} ಹೆಸರಿನ ಗ್ರಾಹಕರು ಖಾತೆಯಲ್ಲಿ ಇಲ್ಲ.",
        "no_consent": "{name} ಇನ್ನೂ WhatsApp ಸಂದೇಶಗಳಿಗೆ ಒಪ್ಪಿಗೆ ನೀಡಿಲ್ಲ.",
        "paid_left": "{name} {amount} ಪಾವತಿಸಿದರು. ಇನ್ನೂ {balance} ಬಾಕಿ ಇದೆ.",
        "paid_clear": "{name} {amount} ಪಾವತಿಸಿದರು. ಪೂರ್ತಿ ಬಾಕಿ ತೀರಿತು.",
        "dispute_alert": "{amount} ನಮೂದು ತಪ್ಪು ಎಂದು {name} ಹೇಳುತ್ತಿದ್ದಾರೆ.",
        "balance_flag_alert": 'ಬಾಕಿ ಮೊತ್ತ ({amount}) ತಪ್ಪು ಎಂದು {name} ಹೇಳುತ್ತಿದ್ದಾರೆ. ನೆನಪುಗಳು ನಿಲ್ಲಿಸಲಾಗಿದೆ.',
        "joined": "{name} ನಿಮ್ಮ ಖಾತೆಗೆ ಸೇರಿದರು.",
        "reminder_sent": "{name} ಅವರಿಗೆ {balance} ನೆನಪು ಕಳುಹಿಸಲಾಗಿದೆ.",
        "outstanding": "{count} ಗ್ರಾಹಕರು ಒಟ್ಟು {total} ಕೊಡಬೇಕು. ಹೆಚ್ಚು: {top}.",
        "for_days": " ({days} ದಿನಗಳಿಂದ)",
        "nobody": "ಈಗ ಯಾರೂ ಬಾಕಿ ಇಟ್ಟಿಲ್ಲ.",
        "customer_balance": "{name} {balance} ಕೊಡಬೇಕು.",
        "customer_balance_days": "{name} {balance} ಕೊಡಬೇಕು, {days} ದಿನಗಳಿಂದ.",
        "customer_clear": "{name} ಅವರಿಗೆ ಬಾಕಿ ಇಲ್ಲ.",
        "confirm_undo_credit": "{name} ಅವರ {amount} ಸಾಲ{items} ತೆಗೆಯಲೇ?",
        "confirm_undo_repayment": "{name} ಅವರ {amount} ಪಾವತಿ ತೆಗೆಯಲೇ?",
        "undone": "ತೆಗೆಯಲಾಗಿದೆ. {name} ಈಗ {balance} ಕೊಡಬೇಕು.",
        "nothing_to_undo": "ಇಂದು ತೆಗೆಯಲು ಯಾವುದೇ ನಮೂದು ಇಲ್ಲ.",
        "undo_paid": "{name} ಆ ಸಾಲವನ್ನು ಈಗಾಗಲೇ ಪಾವತಿಸಿದ್ದಾರೆ, ಆದ್ದರಿಂದ ಅದನ್ನು ತೆಗೆಯಲಾಗುವುದಿಲ್ಲ.",
        "confirm_credit_over_limit": "{name}, {amount} ಸಾಲ{items}. ಈಗಾಗಲೇ {balance} ಬಾಕಿ ಇದೆ; ಇದರಿಂದ {total} ಆಗುತ್ತದೆ, {limit} ಮಿತಿಗಿಂತ ಹೆಚ್ಚು. ಆದರೂ ಉಳಿಸಲೇ?",
        "more_than_due": "{name} ಕೇವಲ {balance} ಕೊಡಬೇಕು, {amount} ಅಲ್ಲ. ದಯವಿಟ್ಟು ಮೊತ್ತವನ್ನು ಮತ್ತೆ ಹೇಳಿ.",
        "today_summary": "ಇಂದು: ನಗದು ಮಾರಾಟ {sales}, ಸಾಲ ಕೊಟ್ಟದ್ದು {given}, ವಸೂಲಿ {collected}.",
    },
    "ta-IN": {
        "confirm_credit": "{name}, {amount} கடன்{items}. சேமிக்கவா?",
        "confirm_new_credit": "{name} புதிய வாடிக்கையாளர். {amount} கடன்{items}. சேர்த்து சேமிக்கவா?",
        "confirm_repayment": "{name} {amount} கொடுத்தார்{mode}. சேமிக்கவா?",
        "confirm_cash_sale": "ரொக்க விற்பனை {amount}. சேமிக்கவா?",
        "confirm_request": "{name} க்கு {amount} பணம் செலுத்தும் லிங்க் அனுப்பவா?",
        "which_customer": "எந்த {name}? {options}",
        "saved": "சேமிக்கப்பட்டது.",
        "saved_balance": "சேமிக்கப்பட்டது. {name} இப்போது {balance} தர வேண்டும்.",
        "saved_clear": "சேமிக்கப்பட்டது. {name} க்கு பாக்கி இல்லை.",
        "request_sent": "{name} க்கு லிங்க் அனுப்பப்பட்டது.",
        "cancelled": "ரத்து செய்யப்பட்டது. எதுவும் சேமிக்கப்படவில்லை.",
        "not_understood": "புரியவில்லை, மீண்டும் சொல்லுங்கள்.",
        "nothing_pending": "சேமிக்க எதுவும் காத்திருக்கவில்லை.",
        "unknown_customer": "{name} என்ற வாடிக்கையாளர் கணக்கில் இல்லை.",
        "no_consent": "{name} இன்னும் WhatsApp செய்திகளுக்கு அனுமதி தரவில்லை.",
        "paid_left": "{name} {amount} செலுத்தினார். இன்னும் {balance} பாக்கி.",
        "paid_clear": "{name} {amount} செலுத்தினார். முழு பாக்கியும் தீர்ந்தது.",
        "dispute_alert": "{amount} பதிவு தவறு என்று {name} சொல்கிறார்.",
        "balance_flag_alert": 'பாக்கி தொகை ({amount}) தவறு என்று {name} சொல்கிறார். நினைவூட்டல்கள் நிறுத்தப்பட்டன.',
        "joined": "{name} உங்கள் கணக்கில் இணைந்தார்.",
        "reminder_sent": "{name} க்கு {balance} நினைவூட்டல் அனுப்பப்பட்டது.",
        "outstanding": "{count} வாடிக்கையாளர்கள் மொத்தம் {total} தர வேண்டும். அதிகம்: {top}.",
        "for_days": " ({days} நாட்களாக)",
        "nobody": "இப்போது யாரும் பாக்கி வைக்கவில்லை.",
        "customer_balance": "{name} {balance} தர வேண்டும்.",
        "customer_balance_days": "{name} {balance} தர வேண்டும், {days} நாட்களாக.",
        "customer_clear": "{name} க்கு பாக்கி இல்லை.",
        "confirm_undo_credit": "{name} இன் {amount} கடன்{items} நீக்கவா?",
        "confirm_undo_repayment": "{name} செலுத்திய {amount} ஐ நீக்கவா?",
        "undone": "நீக்கப்பட்டது. {name} இப்போது {balance} தர வேண்டும்.",
        "nothing_to_undo": "இன்று நீக்க எந்த பதிவும் இல்லை.",
        "undo_paid": "{name} அந்தக் கடனை ஏற்கனவே செலுத்திவிட்டார், அதனால் நீக்க முடியாது.",
        "confirm_credit_over_limit": "{name}, {amount} கடன்{items}. ஏற்கனவே {balance} பாக்கி; இதனால் {total} ஆகும், {limit} வரம்பை தாண்டும். இருந்தாலும் சேமிக்கவா?",
        "more_than_due": "{name} {balance} மட்டுமே தர வேண்டும், {amount} அல்ல. தொகையை மீண்டும் சொல்லுங்கள்.",
        "today_summary": "இன்று: ரொக்க விற்பனை {sales}, கடன் கொடுத்தது {given}, வசூல் {collected}.",
    },
    "te-IN": {
        "confirm_credit": "{name}, {amount} అప్పు{items}. సేవ్ చేయనా?",
        "confirm_new_credit": "{name} కొత్త కస్టమర్. {amount} అప్పు{items}. జోడించి సేవ్ చేయనా?",
        "confirm_repayment": "{name} {amount} ఇచ్చారు{mode}. సేవ్ చేయనా?",
        "confirm_cash_sale": "నగదు అమ్మకం {amount}. సేవ్ చేయనా?",
        "confirm_request": "{name} కి {amount} పేమెంట్ లింక్ పంపనా?",
        "which_customer": "ఏ {name}? {options}",
        "saved": "సేవ్ అయింది.",
        "saved_balance": "సేవ్ అయింది. {name} ఇప్పుడు {balance} ఇవ్వాలి.",
        "saved_clear": "సేవ్ అయింది. {name} కి బాకీ లేదు.",
        "request_sent": "{name} కి లింక్ పంపాను.",
        "cancelled": "రద్దు చేశాను. ఏదీ సేవ్ కాలేదు.",
        "not_understood": "అర్థం కాలేదు, దయచేసి మళ్ళీ చెప్పండి.",
        "nothing_pending": "సేవ్ చేయడానికి ఏమీ లేదు.",
        "unknown_customer": "{name} అనే కస్టమర్ ఖాతాలో లేరు.",
        "no_consent": "{name} ఇంకా WhatsApp మెసేజ్‌లకు అనుమతి ఇవ్వలేదు.",
        "paid_left": "{name} {amount} చెల్లించారు. ఇంకా {balance} బాకీ ఉంది.",
        "paid_clear": "{name} {amount} చెల్లించారు. మొత్తం బాకీ తీరింది.",
        "dispute_alert": "{amount} ఎంట్రీ తప్పు అని {name} అంటున్నారు.",
        "balance_flag_alert": 'బాకీ మొత్తం ({amount}) తప్పు అని {name} అంటున్నారు. గుర్తులు ఆపబడ్డాయి.',
        "joined": "{name} మీ ఖాతాలో చేరారు.",
        "reminder_sent": "{name} కి {balance} గుర్తు పంపాను.",
        "outstanding": "{count} మంది కస్టమర్లు మొత్తం {total} ఇవ్వాలి. ఎక్కువ: {top}.",
        "for_days": " ({days} రోజులుగా)",
        "nobody": "ఇప్పుడు ఎవరికీ బాకీ లేదు.",
        "customer_balance": "{name} {balance} ఇవ్వాలి.",
        "customer_balance_days": "{name} {balance} ఇవ్వాలి, {days} రోజులుగా.",
        "customer_clear": "{name} కి బాకీ లేదు.",
        "confirm_undo_credit": "{name} యొక్క {amount} అప్పు{items} తీసేయనా?",
        "confirm_undo_repayment": "{name} చెల్లించిన {amount} తీసేయనా?",
        "undone": "తీసేశాను. {name} ఇప్పుడు {balance} ఇవ్వాలి.",
        "nothing_to_undo": "ఈ రోజు తీసేయడానికి ఎంట్రీ ఏదీ లేదు.",
        "undo_paid": "{name} ఆ అప్పు ఇప్పటికే చెల్లించారు, కాబట్టి దాన్ని తీసేయలేము.",
        "confirm_credit_over_limit": "{name}, {amount} అప్పు{items}. ఇప్పటికే {balance} బాకీ ఉంది; దీనితో {total} అవుతుంది, {limit} పరిమితి దాటుతుంది. అయినా సేవ్ చేయనా?",
        "more_than_due": "{name} {balance} మాత్రమే ఇవ్వాలి, {amount} కాదు. దయచేసి మొత్తం మళ్ళీ చెప్పండి.",
        "today_summary": "ఈ రోజు: నగదు అమ్మకాలు {sales}, ఇచ్చిన అప్పు {given}, వసూలు {collected}.",
    },
}

# ------------------------------------------------------------------ to the customer
CUSTOMER = {
    "en-IN": {
        "credit_note": "{shop} noted {amount} on your account{items}. Total due: {balance}.",
        "reminder_1": "Hi {name}, a friendly reminder from {shop}: {balance} is due. Pay here: {link}",
        "reminder_2": "Hi {name}, {balance} is still due at {shop}. Please pay when you can: {link}",
        "reminder_3": "Hi {name}, {balance} at {shop} has been due for a while. Please clear it here: {link}",
        "payment_request": "{shop} has sent you a payment request for {amount}. Pay here: {link}",
        "receipt": "Thank you, {name}! {shop} received {amount}. Remaining: {balance}.",
        "dispute_ack": "Thanks. We've asked {shop} to check this entry.",
        "entry_removed": "{shop} removed a {amount} entry from your account. Total due: {balance}.",
        "balance_corrected": "{shop} added {amount} to your account. Total due: {balance}. Is this right?",
        "statement_head": "{name}, your khata at {shop}:",
        "st_credit": "Udhaar {amount}{items}",
        "st_payment": "Paid {amount}",
        "st_removed": "Removed {amount}",
        "st_corrected": "Corrected {sign}{amount}",
        "st_flagged": " (you said wrong)",
        "statement_total": "Total due: {balance}",
        "statement_clear": "Nothing due. Thank you!",
        "statement_pay": "Pay here: {link}",
        "dispute_paid": "Part of this entry is already paid, so it can't be marked wrong here. Please talk to {shop}.",
        "optout_ack": "You won't get reminders from {shop} anymore.",
        "footer": "Reply STOP to stop reminders.",
        "btn_ack": "Correct",
        "btn_dispute": "Wrong amount",
        "pending_line": 'Pending: {balance} across {n} entries, the oldest {days} days ago.',
        "btn_pay": 'Pay now',
        "btn_flag_balance": 'Amount wrong?',
        "btn_stop": 'STOP',
        "balance_flag_ack": "Thanks. We've asked {shop} to check your account. Reminders are paused until they do.",
        "statement": 'Your account at {shop}:\n{lines}\nTotal pending: {balance}.',
    },
    "hi-IN": {
        "credit_note": "{shop} ने आपके खाते में {amount} उधार लिखा है{items}। कुल बकाया: {balance}।",
        "reminder_1": "नमस्ते {name}, {shop} की ओर से याद दिला रहे हैं: {balance} बकाया है। यहाँ भुगतान करें: {link}",
        "reminder_2": "नमस्ते {name}, {shop} में {balance} अभी भी बकाया है। सुविधा अनुसार भुगतान करें: {link}",
        "reminder_3": "नमस्ते {name}, {shop} में {balance} काफ़ी समय से बकाया है। कृपया यहाँ चुकाएँ: {link}",
        "payment_request": "{shop} ने आपको {amount} का भुगतान अनुरोध भेजा है। यहाँ भुगतान करें: {link}",
        "receipt": "धन्यवाद {name}! {shop} को {amount} मिल गए। बाकी: {balance}।",
        "dispute_ack": "धन्यवाद। हमने {shop} को यह एंट्री जाँचने को कहा है।",
        "entry_removed": "{shop} ने आपके खाते से {amount} की एंट्री हटा दी। कुल बकाया: {balance}।",
        "balance_corrected": "{shop} ने आपके खाते में {amount} जोड़ा है। कुल बकाया: {balance}। क्या यह सही है?",
        "statement_head": "{name}, {shop} में आपका खाता:",
        "st_credit": "उधार {amount}{items}",
        "st_payment": "भुगतान {amount}",
        "st_removed": "हटाया {amount}",
        "st_corrected": "सुधार {sign}{amount}",
        "st_flagged": " (आपने गलत बताया)",
        "statement_total": "कुल बकाया: {balance}",
        "statement_clear": "कोई बकाया नहीं। धन्यवाद!",
        "statement_pay": "यहाँ भुगतान करें: {link}",
        "dispute_paid": "इस एंट्री का कुछ हिस्सा पहले ही चुका दिया गया है, इसलिए इसे यहाँ गलत नहीं बताया जा सकता। कृपया {shop} से बात करें।",
        "optout_ack": "अब आपको {shop} से रिमाइंडर नहीं मिलेंगे।",
        "footer": "रिमाइंडर बंद करने के लिए STOP लिखें।",
        "btn_ack": "सही है",
        "btn_dispute": "गलत रकम",
        "pending_line": 'बकाया: {balance}, {n} एंट्री, सबसे पुरानी {days} दिन पहले की।',
        "btn_pay": 'अभी भुगतान करें',
        "btn_flag_balance": 'राशि गलत है?',
        "btn_stop": 'STOP',
        "balance_flag_ack": 'धन्यवाद। हमने {shop} से आपका खाता जाँचने को कहा है। तब तक रिमाइंडर रुके रहेंगे।',
        "statement": '{shop} में आपका खाता:\n{lines}\nकुल बकाया: {balance}।',
    },
    "kn-IN": {
        "credit_note": "{shop} ನಿಮ್ಮ ಖಾತೆಗೆ {amount} ಸಾಲ ಬರೆದಿದೆ{items}. ಒಟ್ಟು ಬಾಕಿ: {balance}.",
        "reminder_1": "ನಮಸ್ಕಾರ {name}, {shop} ನಿಂದ ಒಂದು ನೆನಪು: {balance} ಬಾಕಿ ಇದೆ. ಇಲ್ಲಿ ಪಾವತಿಸಿ: {link}",
        "reminder_2": "ನಮಸ್ಕಾರ {name}, {shop} ನಲ್ಲಿ {balance} ಇನ್ನೂ ಬಾಕಿ ಇದೆ. ಅನುಕೂಲವಾದಾಗ ಪಾವತಿಸಿ: {link}",
        "reminder_3": "ನಮಸ್ಕಾರ {name}, {shop} ನಲ್ಲಿ {balance} ಬಹಳ ದಿನಗಳಿಂದ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಇಲ್ಲಿ ಪಾವತಿಸಿ: {link}",
        "payment_request": "{shop} ನಿಮಗೆ {amount} ಪಾವತಿ ವಿನಂತಿ ಕಳುಹಿಸಿದೆ. ಇಲ್ಲಿ ಪಾವತಿಸಿ: {link}",
        "receipt": "ಧನ್ಯವಾದ {name}! {shop} ಗೆ {amount} ಸಿಕ್ಕಿದೆ. ಉಳಿದದ್ದು: {balance}.",
        "dispute_ack": "ಧನ್ಯವಾದ. ಈ ನಮೂದನ್ನು ಪರಿಶೀಲಿಸಲು {shop} ಗೆ ತಿಳಿಸಿದ್ದೇವೆ.",
        "entry_removed": "{shop} ನಿಮ್ಮ ಖಾತೆಯಿಂದ {amount} ನಮೂದನ್ನು ತೆಗೆದಿದೆ. ಒಟ್ಟು ಬಾಕಿ: {balance}.",
        "balance_corrected": "{shop} ನಿಮ್ಮ ಖಾತೆಗೆ {amount} ಸೇರಿಸಿದೆ. ಒಟ್ಟು ಬಾಕಿ: {balance}. ಇದು ಸರಿಯೇ?",
        "statement_head": "{name}, {shop} ನಲ್ಲಿ ನಿಮ್ಮ ಖಾತೆ:",
        "st_credit": "ಸಾಲ {amount}{items}",
        "st_payment": "ಪಾವತಿ {amount}",
        "st_removed": "ತೆಗೆದದ್ದು {amount}",
        "st_corrected": "ತಿದ್ದುಪಡಿ {sign}{amount}",
        "st_flagged": " (ತಪ್ಪು ಎಂದು ನೀವು ಹೇಳಿದ್ದೀರಿ)",
        "statement_total": "ಒಟ್ಟು ಬಾಕಿ: {balance}",
        "statement_clear": "ಯಾವುದೇ ಬಾಕಿ ಇಲ್ಲ. ಧನ್ಯವಾದ!",
        "statement_pay": "ಇಲ್ಲಿ ಪಾವತಿಸಿ: {link}",
        "dispute_paid": "ಈ ನಮೂದಿನ ಸ್ವಲ್ಪ ಭಾಗ ಈಗಾಗಲೇ ಪಾವತಿಯಾಗಿದೆ, ಆದ್ದರಿಂದ ಇದನ್ನು ಇಲ್ಲಿ ತಪ್ಪು ಎನ್ನಲಾಗುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು {shop} ಜೊತೆ ಮಾತನಾಡಿ.",
        "optout_ack": "ಇನ್ನು ಮುಂದೆ {shop} ನಿಂದ ನೆನಪುಗಳು ಬರುವುದಿಲ್ಲ.",
        "footer": "ನೆನಪುಗಳನ್ನು ನಿಲ್ಲಿಸಲು STOP ಎಂದು ಕಳುಹಿಸಿ.",
        "btn_ack": "ಸರಿ",
        "btn_dispute": "ತಪ್ಪು ಮೊತ್ತ",
        "pending_line": 'ಬಾಕಿ: {balance}, {n} ನಮೂದುಗಳು, ಹಳೆಯದು {days} ದಿನಗಳ ಹಿಂದಿನದು.',
        "btn_pay": 'ಈಗ ಪಾವತಿಸಿ',
        "btn_flag_balance": 'ಮೊತ್ತ ತಪ್ಪೇ?',
        "btn_stop": 'STOP',
        "balance_flag_ack": 'ಧನ್ಯವಾದ. ನಿಮ್ಮ ಖಾತೆ ಪರಿಶೀಲಿಸಲು {shop} ಗೆ ಹೇಳಿದ್ದೇವೆ. ಅಲ್ಲಿಯವರೆಗೆ ನೆನಪುಗಳು ನಿಲ್ಲುತ್ತವೆ.',
        "statement": '{shop} ನಲ್ಲಿ ನಿಮ್ಮ ಖಾತೆ:\n{lines}\nಒಟ್ಟು ಬಾಕಿ: {balance}.',
    },
    "ta-IN": {
        "credit_note": "{shop} உங்கள் கணக்கில் {amount} கடன் பதிவு செய்துள்ளது{items}. மொத்த பாக்கி: {balance}.",
        "reminder_1": "வணக்கம் {name}, {shop} இலிருந்து ஒரு நினைவூட்டல்: {balance} பாக்கி உள்ளது. இங்கே செலுத்தலாம்: {link}",
        "reminder_2": "வணக்கம் {name}, {shop} இல் {balance} இன்னும் பாக்கி உள்ளது. வசதிப்படி செலுத்துங்கள்: {link}",
        "reminder_3": "வணக்கம் {name}, {shop} இல் {balance} நீண்ட நாட்களாக பாக்கி உள்ளது. தயவுசெய்து இங்கே செலுத்துங்கள்: {link}",
        "payment_request": "{shop} உங்களுக்கு {amount} செலுத்த கோரிக்கை அனுப்பியுள்ளது. இங்கே செலுத்துங்கள்: {link}",
        "receipt": "நன்றி {name}! {shop} க்கு {amount} கிடைத்தது. மீதம்: {balance}.",
        "dispute_ack": "நன்றி. இந்த பதிவை சரிபார்க்க {shop} இடம் சொல்லியுள்ளோம்.",
        "entry_removed": "{shop} உங்கள் கணக்கிலிருந்து {amount} பதிவை நீக்கியுள்ளது. மொத்த பாக்கி: {balance}.",
        "balance_corrected": "{shop} உங்கள் கணக்கில் {amount} சேர்த்துள்ளது. மொத்த பாக்கி: {balance}. இது சரியா?",
        "statement_head": "{name}, {shop} இல் உங்கள் கணக்கு:",
        "st_credit": "கடன் {amount}{items}",
        "st_payment": "செலுத்தியது {amount}",
        "st_removed": "நீக்கியது {amount}",
        "st_corrected": "திருத்தம் {sign}{amount}",
        "st_flagged": " (தவறு என்று நீங்கள் சொன்னீர்கள்)",
        "statement_total": "மொத்த பாக்கி: {balance}",
        "statement_clear": "பாக்கி எதுவும் இல்லை. நன்றி!",
        "statement_pay": "இங்கே செலுத்துங்கள்: {link}",
        "dispute_paid": "இந்த பதிவின் ஒரு பகுதி ஏற்கனவே செலுத்தப்பட்டுவிட்டது, அதனால் இங்கே தவறு என குறிக்க முடியாது. தயவுசெய்து {shop} இடம் பேசுங்கள்.",
        "optout_ack": "இனி {shop} இலிருந்து நினைவூட்டல்கள் வராது.",
        "footer": "நினைவூட்டல்களை நிறுத்த STOP என அனுப்பவும்.",
        "btn_ack": "சரி",
        "btn_dispute": "தவறான தொகை",
        "pending_line": 'பாக்கி: {balance}, {n} பதிவுகள், பழையது {days} நாட்களுக்கு முன்.',
        "btn_pay": 'இப்போது செலுத்து',
        "btn_flag_balance": 'தொகை தவறா?',
        "btn_stop": 'STOP',
        "balance_flag_ack": 'நன்றி. உங்கள் கணக்கைச் சரிபார்க்க {shop} இடம் கேட்டுள்ளோம். அதுவரை நினைவூட்டல்கள் நிறுத்தப்படும்.',
        "statement": '{shop} இல் உங்கள் கணக்கு:\n{lines}\nமொத்த பாக்கி: {balance}.',
    },
    "te-IN": {
        "credit_note": "{shop} మీ ఖాతాలో {amount} అప్పు రాసింది{items}. మొత్తం బాకీ: {balance}.",
        "reminder_1": "నమస్కారం {name}, {shop} నుండి ఒక గుర్తు: {balance} బాకీ ఉంది. ఇక్కడ చెల్లించండి: {link}",
        "reminder_2": "నమస్కారం {name}, {shop} లో {balance} ఇంకా బాకీ ఉంది. వీలైనప్పుడు చెల్లించండి: {link}",
        "reminder_3": "నమస్కారం {name}, {shop} లో {balance} చాలా రోజులుగా బాకీ ఉంది. దయచేసి ఇక్కడ చెల్లించండి: {link}",
        "payment_request": "{shop} మీకు {amount} చెల్లింపు అభ్యర్థన పంపింది. ఇక్కడ చెల్లించండి: {link}",
        "receipt": "ధన్యవాదాలు {name}! {shop} కి {amount} అందింది. మిగిలింది: {balance}.",
        "dispute_ack": "ధన్యవాదాలు. ఈ ఎంట్రీని తనిఖీ చేయమని {shop} కి చెప్పాము.",
        "entry_removed": "{shop} మీ ఖాతా నుండి {amount} ఎంట్రీని తీసేసింది. మొత్తం బాకీ: {balance}.",
        "balance_corrected": "{shop} మీ ఖాతాలో {amount} జోడించింది. మొత్తం బాకీ: {balance}. ఇది సరైనదేనా?",
        "statement_head": "{name}, {shop} లో మీ ఖాతా:",
        "st_credit": "అప్పు {amount}{items}",
        "st_payment": "చెల్లింపు {amount}",
        "st_removed": "తీసేసింది {amount}",
        "st_corrected": "సవరణ {sign}{amount}",
        "st_flagged": " (తప్పు అని మీరు చెప్పారు)",
        "statement_total": "మొత్తం బాకీ: {balance}",
        "statement_clear": "బాకీ ఏమీ లేదు. ధన్యవాదాలు!",
        "statement_pay": "ఇక్కడ చెల్లించండి: {link}",
        "dispute_paid": "ఈ ఎంట్రీలో కొంత భాగం ఇప్పటికే చెల్లించారు, కాబట్టి ఇక్కడ తప్పు అని గుర్తించలేము. దయచేసి {shop} తో మాట్లాడండి.",
        "optout_ack": "ఇకపై {shop} నుండి గుర్తుచేయడాలు రావు.",
        "footer": "గుర్తుచేయడం ఆపడానికి STOP అని పంపండి.",
        "btn_ack": "సరైనది",
        "btn_dispute": "తప్పు మొత్తం",
        "pending_line": 'బాకీ: {balance}, {n} ఎంట్రీలు, పాతది {days} రోజుల క్రితం.',
        "btn_pay": 'ఇప్పుడు చెల్లించండి',
        "btn_flag_balance": 'మొత్తం తప్పా?',
        "btn_stop": 'STOP',
        "balance_flag_ack": 'ధన్యవాదాలు. మీ ఖాతాను తనిఖీ చేయమని {shop} కి చెప్పాము. అప్పటివరకు గుర్తులు ఆగుతాయి.',
        "statement": '{shop} లో మీ ఖాతా:\n{lines}\nమొత్తం బాకీ: {balance}.',
    },
}


class _Keep(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def norm_lang(lang: str | None) -> str:
    return lang if lang in LANGUAGES else "en-IN"


def inr(rupees: int | float) -> str:
    """Indian digit grouping: 123456 -> 1,23,456."""
    n = int(round(rupees))
    sign = "-" if n < 0 else ""
    s = str(abs(n))
    if len(s) <= 3:
        return sign + s
    head, tail = s[:-3], s[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return sign + ",".join(groups + [tail])


def money(rupees: int | float, lang: str, spoken: bool) -> str:
    if spoken:
        return f"{int(round(rupees))} {RUPEE_WORD[norm_lang(lang)]}"
    return f"₹{inr(rupees)}"


def items_text(items: list | None) -> str:
    items = [i for i in (items or []) if i]
    return f" ({', '.join(items)})" if items else ""


def _render(table: dict, lang: str, key: str, spoken: bool, values: dict) -> str:
    lang = norm_lang(lang)
    template = table.get(lang, {}).get(key) or table["en-IN"][key]
    prepared = {}
    for k, v in values.items():
        if k in MONEY_KEYS and isinstance(v, (int, float)):
            prepared[k] = money(v, lang, spoken)
        else:
            prepared[k] = "" if v is None else v
    return template.format_map(_Keep(prepared))


def say(lang: str, key: str, spoken: bool = False, **values) -> str:
    """Phrase for the merchant (shown on screen, or spoken when spoken=True)."""
    return _render(MERCHANT, lang, key, spoken, values)


def customer_text(lang: str, key: str, **values) -> str:
    """Phrase for a customer message (always the on-screen format)."""
    return _render(CUSTOMER, lang, key, False, values)
