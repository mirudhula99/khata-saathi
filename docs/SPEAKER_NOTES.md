# Khata Saathi: speaker notes for the finals (Sat 31 Oct 2026)

Total: 3 minutes talk + 90 seconds live demo + Q&A. You present. Your friend drives the laptop and answers the AI questions.

## Before you go on (10 minutes before, every time)

1. Laptop on your phone hotspot, not venue Wi-Fi. Chrome open.
2. Restart the server: Ctrl+C in the server window, then `run-windows.cmd` (or the uvicorn command). Open http://localhost:8000.
3. More → **Reset demo data** → Reset. Check the home chart says ₹1,240 pending · 3 customers.
4. Second tab: Customer's phone, pick **Lakshmi**. Keep it open; you will switch to it twice.
5. Decide voice or type. If the room is loud or the key is off, type. The flow is identical. Do not fight the mic on stage.
6. Language dropdown: Tamil (or whatever you will actually speak). Read-backs come in that language.
7. Phone in your pocket with the backup demo video.

## Slide 1, Title (0:00 to 0:20)

**Say:** "Hi, we're Team Rupeeriot. This is Khata Saathi. The three bubbles on the right are the whole product: a shopkeeper says 'Lakshmi ku 150 rupees udhaar', Saathi reads it back, and three days later Lakshmi has paid through Paytm. In the next three minutes I'll show you that loop running for real."

## Slide 2, Problem (0:20 to 0:55)

**Say:** "Every kirana gives udhaar to regulars. It lives in a notebook or the owner's head. Three things go wrong: entries get lost, asking a neighbour for money is awkward so they don't, and the money sits with customers until someone says 'I never took that much'. India has about 1.2 crore kiranas. 1.17 crore merchants already have a Paytm Soundbox on the counter. [Survey line, if you did it:] We asked five shopkeepers near [area]: [X] had udhaar pending, about ₹[amount] each. One told us '[quote]'."

**If asked for sources:** Nielsen estimate for kiranas, Paytm's Q3 FY25 investor update for Soundbox.

## Slide 3, Solution (0:55 to 1:25)

**Say, counting on fingers:** "Five steps. Speak the entry in Hindi, Kannada, Tamil or Telugu. Saathi confirms by reading it back, and the customer can confirm or flag it on WhatsApp. It reminds politely, on the merchant's schedule, with consent. It collects through a Paytm link, full or partial. And it reconciles: a verified payment updates the balance and stops the reminders. You can also just ask it: 'Who owes me money?' Let me show you."

## LIVE DEMO (1:25 to 2:55). Narrate every tap. Pause after each reply so judges hear it.

| Step | Do | Say while it happens |
|---|---|---|
| 1 | Home. Type or say **"Who owes me money?"** | "First, the question every shopkeeper asks at closing time." Reply: *3 customers owe ₹1,240. Ramesh ₹800 for 40 days…* "That's the whole notebook, answered in one sentence." |
| 2 | Type or say **"Lakshmi ku 150 rupees udhaar, 2 kg rice"** | "Now a new entry, the way a merchant actually talks: Tamil and English mixed." Read-back appears. "Nothing is saved yet. AI understands, code calculates. The merchant approves." Tap **Save**. |
| 3 | Switch to the Lakshmi tab | "Lakshmi gets this on WhatsApp instantly, in her language, with Confirm and Flag. Two-sided entries: no more 'I never took that much'." Tap **Confirm**. Switch back. |
| 4 | More → **Move time forward 3 days** | "On stage we can't wait three days, so we move the clock. Reminders go out on a schedule, 9am to 8pm, at most one a day, only with consent." Caption now shows the shifted date. |
| 5 | Lakshmi tab: the reminder bubble | "This is the actual message. Polite, from the shop, with a Paytm link." Tap **Pay now** → **Pay ₹150**. |
| 6 | Back to home. Toast says Lakshmi paid. Chart updates. | "Verified payment, balance zero, reminders stop by themselves. Only a verified payment closes udhaar; cash is noted separately." |
| 7 | Type or say **"Who owes me money?"** again | "Back to the original three. Every rupee accounted for." |

**Bonus if time (15 s):** type "Ramesh paid 300 cash" → "Which Ramesh?" dialog. "Two Rameshes. It never guesses on money."

**Handoff line:** "[Friend] built this pipeline. He'll take the technical questions."

## Slide 5, Tech (friend, 2:55 to 3:15)

Friend says: "Sarvam speech-to-text for code-mixed Indian speech, an LLM that only extracts name, amount and items as structured output, a validator that checks the amount was actually spoken, and a plain Python ledger that does every rupee of maths. The LLM never writes a balance."

## Slide 8, Business (you, 3:15 to 3:35)

**Say:** "Free for merchants. Paytm gains payment volume that was cash or never paid, and a daily-use reason to keep the Soundbox. You already own the ledger and the payment rail; we're the voice layer that makes merchants use it. Rollout is an app update to existing Soundbox merchants, pilot in Bengaluru and Chennai. Record udhaar. Track every rupee. Collect with dignity. Thank you."

## If something breaks

- Mic does nothing: tap the type field and type the same sentence. Say "noisy room, I'll type it". Nobody minds.
- Read-back comes back wrong: type "No, 150". That IS the correction feature. Say so.
- Server error toast: More → Reset demo data, start the demo from step 1. 40 seconds lost, not the pitch.
- Chrome tab dies: the backup video on your phone. Narrate over it.

## Judge questions you own (friend takes the AI ones)

- **Khatabook and Paytm Business Khata already do this.** "Yes, and merchants still use notebooks because typing at a busy counter is slower than a pen. We're the voice layer. The ledger talks back, every entry is two-sided, and a verified payment closes it automatically. We don't replace your khata, we make it get used."
- **Won't reminders annoy customers?** "Consent first, merchant sets the schedule, at most one a day, 9am to 8pm, pause anytime, stops at zero, customer can reply STOP. You just saw the actual message."
- **What's simulated today?** Be straight: "WhatsApp is a simulator with the Cloud API wired behind a flag. Paytm is a mock provider that signs a webhook through the same verification and ledger code a real callback hits. Everything else, the ledger, the guardrails, the reconciliation, is real."
- **Why no credit score?** "The merchant knows the customer better than a model. We show the record and keep the decision human. A score would be a black box over a neighbour."
- **How does Paytm make money?** "Volume and retention now; consented merchant services and a premium tier later. Zero cost to the merchant."

## Numbers to have in your head

₹1,240 pending across 3 customers. Ramesh ₹800 for 40 days. Lakshmi's entry ₹150. 1.2 crore kiranas. 1.17 crore Soundbox merchants. Four languages plus English. 9am to 8pm, one reminder a day.
