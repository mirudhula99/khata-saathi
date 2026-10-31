# Khata Saathi: demo video script (2 min 50 s)

Record the screen silently, then lay an AI voiceover on top. Everything below is what the app really does today.

## Before you record

1. Server running, then **More → hold the "More" title → Reset demo data → Reset**.
2. **More → "I speak, Saathi replies in" → English.** You switch to Tamil only in the last shot.
3. Chrome, one window, phone-sized. Open three tabs and leave them ready:
   - Tab 1: `http://localhost:8000` (the shop app)
   - Tab 2: `http://localhost:8000/customer?id=1` (Lakshmi's WhatsApp)
   - Tab 3: `http://localhost:8000/paytm?id=4` (Ravi's Paytm app)
4. Check the home charts read **₹2,450 pending · 8 customers**.
5. Quiet room: when you tap the mic you must actually speak, even though your voice is discarded later.
6. Recorder: Windows **Win + G**, or OBS. Record at 1080p, no microphone track.

## The shots

| # | Time | On screen | Voiceover |
|---|---|---|---|
| 1 | 0:00–0:14 | Home screen, still. Slowly scroll once to show the mic, the quick actions and the two charts, then scroll back up. | Every kirana shop in India gives udhaar, informal credit, to its regulars. It lives in a paper notebook. Entries get lost, totals go wrong, and asking a neighbour for money is awkward. This is Khata Saathi. |
| 2 | 0:14–0:42 | Tap the big mic. The listening sheet opens with the waveform. Say **"Lakshmi ku 150 rupees udhaar, 2 kg rice"**. Tap the mic to stop. The read-back card appears. Pause on it for two seconds, then tap **Save**. | The shopkeeper just speaks. Lakshmi ku one fifty rupees udhaar, two kilo rice. Tamil and English mixed, the way people actually talk. Saathi hears it with Sarvam speech recognition, pulls out the name, the amount and the items, and reads it back. Nothing is saved yet. If it mishears, the merchant says "no, one fifty" and corrects it before anything touches the ledger. |
| 3 | 0:42–1:00 | Switch to tab 2, Lakshmi's WhatsApp. The entry has arrived with two buttons. Tap **Correct**. | Lakshmi gets the entry on WhatsApp instantly, in her own language, with two buttons. Correct, or wrong amount. Every entry is two sided. That is what ends the old argument of "I never took that much". |
| 4 | 1:00–1:20 | Back to tab 1. Type **"Who owes me money?"** in the "or type it" box and press Enter. Let the answer card appear. Scroll down to the "Today" card and the two charts. | Now the question every shopkeeper asks at closing time. Who owes me money? Eight customers owe two thousand four hundred and fifty rupees. Ramesh owes eight hundred, pending forty days. The same ledger draws today's cash and this week's udhaar against money collected. |
| 5 | 1:20–1:50 | Reminders tab. Tap the **ⓘ** icon, let the rules bubble show, tap to close. Tap the **pen** on Ramesh's row, show the message sheet, close it. Point the cursor at the channel marks: green for WhatsApp, wallet for Paytm. | Reminders go out politely, on the shop's schedule. Only with consent, at most one a day, nine in the morning to eight at night, paused the moment an entry is disputed, and stopped the moment the balance is zero. The merchant sees the exact message and can add a line of their own. And look at the channel marks. Some customers get WhatsApp. Others get the reminder inside the Paytm app. |
| 6 | 1:50–2:12 | On Ravi's row tap **Remind now**, then the small wallet icon. Tab 3 opens: the Paytm app with the notification. Tap **Pay ₹290**, then **Pay ₹290** in the sheet. Green tick. Switch back to tab 1. | Ravi pays from inside Paytm, with wallet, UPI, cards or net banking. The payment is verified through the webhook, so the balance updates by itself, the reminder stops, and the shopkeeper hears it announced. Only a verified payment closes an udhaar. Cash is noted separately. Our rule is simple. AI understands, code calculates. The model never touches a balance. |
| 7 | 2:12–2:32 | Tab 2, Lakshmi's WhatsApp, tap **Amount wrong?** on the reminder. Back to tab 1, tap the **bell**. Show the "Needs you" task, then the Money in and Reminders filters. | If a customer says the amount is wrong, reminders pause at once and the shopkeeper gets a task. No one is chased while a dispute is open. The bell gathers everything that needs them. Flagged entries, customers gone quiet after reminders, people they cannot remind yet. |
| 8 | 2:32–2:50 | More → "I speak, Saathi replies in" → **தமிழ்**. Go back to Saathi, then Khata, then Reminders so the Tamil is visible on three screens. End on the home screen. | And the whole app speaks the shopkeeper's language. Tamil, Kannada, Hindi, Telugu or English. Every screen, every reminder, every notification. A kirana owner in Madurai never has to read English. Khata Saathi. Record udhaar, track every rupee, collect with dignity. |

## Full narration, for the voice AI

Paste this as one block. Target pace about 165 words a minute, Indian English, warm and unhurried. Add a short pause where you see the line breaks.

> Every kirana shop in India gives udhaar, informal credit, to its regulars. It lives in a paper notebook. Entries get lost, totals go wrong, and asking a neighbour for money is awkward. This is Khata Saathi.
>
> The shopkeeper just speaks. Lakshmi ku one fifty rupees udhaar, two kilo rice. Tamil and English mixed, the way people actually talk. Saathi hears it with Sarvam speech recognition, pulls out the name, the amount and the items, and reads it back. Nothing is saved yet. If it mishears, the merchant says "no, one fifty" and corrects it before anything touches the ledger.
>
> Lakshmi gets the entry on WhatsApp instantly, in her own language, with two buttons. Correct, or wrong amount. Every entry is two sided. That is what ends the old argument of "I never took that much".
>
> Now the question every shopkeeper asks at closing time. Who owes me money? Eight customers owe two thousand four hundred and fifty rupees. Ramesh owes eight hundred, pending forty days. The same ledger draws today's cash and this week's udhaar against money collected.
>
> Reminders go out politely, on the shop's schedule. Only with consent, at most one a day, nine in the morning to eight at night, paused the moment an entry is disputed, and stopped the moment the balance is zero. The merchant sees the exact message and can add a line of their own. And look at the channel marks. Some customers get WhatsApp. Others get the reminder inside the Paytm app.
>
> Ravi pays from inside Paytm, with wallet, UPI, cards or net banking. The payment is verified through the webhook, so the balance updates by itself, the reminder stops, and the shopkeeper hears it announced. Only a verified payment closes an udhaar. Cash is noted separately. Our rule is simple. AI understands, code calculates. The model never touches a balance.
>
> If a customer says the amount is wrong, reminders pause at once and the shopkeeper gets a task. No one is chased while a dispute is open. The bell gathers everything that needs them. Flagged entries, customers gone quiet after reminders, people they cannot remind yet.
>
> And the whole app speaks the shopkeeper's language. Tamil, Kannada, Hindi, Telugu or English. Every screen, every reminder, every notification. A kirana owner in Madurai never has to read English. Khata Saathi. Record udhaar, track every rupee, collect with dignity.

## Recording tips

- **Move slowly.** Hold two seconds on every screen after it changes. Fast cursors look nervous on video.
- **One take per shot.** Record the eight shots separately and join them. Re-recording shot 6 is painless; re-recording three minutes is not.
- **The mic shot is the risky one.** If speech recognition stumbles twice, tap the mic and pick a "Try saying" bubble in the listening sheet instead. It looks the same on screen.
- **Hide the cursor** where you can, or move it off the phone frame while a screen is being read.
- **Order of edit:** cut the video first, then stretch or trim shots to fit the voiceover, not the other way round.
- **No background music under the voice**, or keep it under ten percent. Judges watch these with laptop speakers.

## If you have 30 seconds more

Add after shot 4, as a 20-second insert:

> Two customers named Ramesh? Saathi never guesses on money. It asks which one.

On screen: type **"Ramesh paid 300 cash"**, show the "Which Ramesh?" dialog, pick Gandhi Street, then Save.

## What not to show

- The hidden demo tools, the clock and Reset. They explain the stage, not the product.
- The legacy one-screen UI.
- Anything in the More tab beyond the language switch.
