"""Regression tests for ledger guardrails. Run: python -m unittest discover tests

Uses a throwaway database and no API keys, so nothing touches data/khata.db or spends Sarvam credits.
"""
import os
import tempfile
import threading
import unittest

_tmp = tempfile.mkdtemp()
# Set before importing the app. load_dotenv never overrides these, even when .env has a real key.
os.environ.update({
    "DATABASE_URL": f"sqlite:///{_tmp}/test.db", "SARVAM_API_KEY": "", "LLM_API_KEY": "",
    "SCHEDULER_ENABLED": "false", "MERCHANT_LANGUAGE": "en-IN", "QUIET_HOURS": "",
    "MERCHANT_KEY": "test-key", "CLOCK_FILE": f"{_tmp}/clock_offset.txt", "WHATSAPP_APP_SECRET": "",
})

from fastapi.testclient import TestClient  # noqa: E402

from app import clock, seed  # noqa: E402
from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.understand import ParsedCommand, validate  # noqa: E402


class GuardrailTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._client_cm = TestClient(app)
        cls.client = cls._client_cm.__enter__()
        cls.client.cookies.set("khata_key", "test-key")

    @classmethod
    def tearDownClass(cls):
        cls._client_cm.__exit__(None, None, None)

    def setUp(self):
        seed.reset_and_seed()
        self.customers = {f"{c['name']}|{c['note']}": c for c in self.client.get("/api/state").json()["customers"]}

    def say(self, text: str) -> dict:
        return self.client.post("/api/command", json={"text": text, "lang": "en-IN"}).json()

    def balance(self, customer_id: int) -> int:
        return self.client.get(f"/api/customers/{customer_id}").json()["balance"]

    def test_confirm_saves_once_when_tapped_twice(self):
        reply = self.say("Kumaran ku 100 udhaar")
        pending_id, customer_id = reply["pending"]["id"], reply["pending"]["customer"]["id"]
        statuses = []
        threads = [threading.Thread(target=lambda: statuses.append(
            self.client.post(f"/api/actions/{pending_id}/confirm", json={}).status_code)) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(statuses.count(200), 1)
        self.assertEqual(self.balance(customer_id), 100)

    def test_repayment_above_balance_is_refused(self):
        ravi = self.customers["Ravi|"]
        reply = self.say("Ravi paid 5000 cash")
        self.assertIsNone(reply["pending"])
        self.assertIn("owes only ₹290", reply["reply_text"])
        self.assertEqual(self.balance(ravi["id"]), 290)

    def test_correction_above_balance_keeps_entry_waiting(self):
        reply = self.say("Ravi paid 100 cash")
        reply = self.say("no 900")
        self.assertIn("owes only ₹290", reply["reply_text"])
        self.assertEqual(reply["pending"]["amount"], 100)

    def test_payment_request_needs_a_balance(self):
        reply = self.say("Ask Lakshmi for 900")  # Lakshmi owes nothing
        self.assertIsNone(reply["pending"])
        self.assertIn("no dues", reply["reply_text"])
        reply = self.say("Ask Ravi for 900")  # Ravi owes 290
        self.assertIsNone(reply["pending"])
        self.assertIn("owes only ₹290", reply["reply_text"])

    def test_partly_paid_credit_cannot_be_disputed(self):
        suresh = self.customers["Suresh|"]["id"]  # owes 150
        reply = self.say("Suresh ku 200 udhaar")
        self.client.post(f"/api/actions/{reply['pending']['id']}/confirm", json={})
        messages = self.client.get(f"/api/customer-view/{suresh}").json()["messages"]
        dispute_id = [m for m in messages if m["kind"] == "credit_note"][-1]["buttons"][1]["id"]
        reply = self.say("Suresh paid 300 cash")
        self.client.post(f"/api/actions/{reply['pending']['id']}/confirm", json={})
        result = self.client.post(f"/api/customer-view/{suresh}/reply", json={"button_id": dispute_id}).json()
        self.assertEqual(result["action"], "dispute_refused")
        self.assertEqual(self.balance(suresh), 50)

    def test_unpaid_credit_can_still_be_disputed(self):
        lakshmi = self.customers["Lakshmi|Gandhi Nagar"]["id"]
        reply = self.say("Lakshmi ku 150 udhaar")
        self.client.post(f"/api/actions/{reply['pending']['id']}/confirm", json={})
        messages = self.client.get(f"/api/customer-view/{lakshmi}").json()["messages"]
        dispute_id = [m for m in messages if m["kind"] == "credit_note"][-1]["buttons"][1]["id"]
        result = self.client.post(f"/api/customer-view/{lakshmi}/reply", json={"button_id": dispute_id}).json()
        self.assertEqual(result["action"], "dispute")
        self.assertEqual(self.balance(lakshmi), 0)

    def test_join_by_name_does_not_take_over_a_customer(self):
        priya = self.customers["Priya|"]
        self.client.patch(f"/api/customers/{priya['id']}", json={"phone": ""})
        joined = self.client.post("/api/join/1", json={"name": "Priyaa", "phone": "9876543210",
                                                       "consent": True}).json()
        self.assertNotEqual(joined["customer_id"], priya["id"])

    def test_join_by_phone_links_the_existing_customer(self):
        priya = self.customers["Priya|"]
        self.client.patch(f"/api/customers/{priya['id']}", json={"phone": "9876543210"})
        joined = self.client.post("/api/join/1", json={"name": "P", "phone": "+91 98765 43210",
                                                       "consent": True}).json()
        self.assertEqual(joined["customer_id"], priya["id"])


    # ---------------------------------------------------------------- access
    def test_other_devices_need_the_key(self):
        stranger = TestClient(app)
        self.assertEqual(stranger.get("/api/state").status_code, 401)
        self.assertEqual(stranger.post("/api/demo/reset").status_code, 401)
        self.assertEqual(stranger.get("/api/customer-view/1").status_code, 401)
        self.assertEqual(stranger.get("/api/tts?text=hello").status_code, 401)
        self.assertEqual(stranger.get("/").status_code, 401)
        self.assertEqual(stranger.get("/api/join/1").status_code, 200)  # customers still join

    def test_key_link_remembers_the_device(self):
        phone = TestClient(app)
        response = phone.get("/customer?id=1&key=test-key", follow_redirects=False)
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "/customer?id=1")
        self.assertEqual(phone.get("/api/state").status_code, 200)
        self.assertEqual(TestClient(app).get("/?key=wrong").status_code, 401)

    def test_this_computer_needs_no_key_but_the_tunnel_does(self):
        local = TestClient(app, client=("127.0.0.1", 50000))
        self.assertEqual(local.get("/api/state").status_code, 200)
        self.assertEqual(local.get("/api/state", headers={"cf-connecting-ip": "1.2.3.4"}).status_code, 401)

    def test_unsigned_whatsapp_messages_are_rejected(self):
        response = self.client.post("/webhooks/whatsapp", content=b'{"entry": []}')
        self.assertEqual(response.status_code, 403)

    # ---------------------------------------------------------------- payments and amounts
    def test_paid_link_cannot_be_paid_again(self):
        reply = self.say("Ask Ravi for 100")
        self.client.post(f"/api/actions/{reply['pending']['id']}/confirm", json={})
        link = self.client.get(f"/api/customer-view/{self.customers['Ravi|']['id']}").json()["messages"][-1]["link_url"]
        link_id = link.rsplit("/", 1)[-1]
        self.assertEqual(self.client.post(f"/api/pay/{link_id}/simulate", json={}).status_code, 200)
        self.assertEqual(self.client.post(f"/api/pay/{link_id}/simulate", json={}).status_code, 400)

    def test_quantity_is_not_taken_as_the_amount(self):
        cmd = ParsedCommand(intent="add_credit", customer_name="Lakshmi", amount=2)
        self.assertEqual(validate(cmd, "Lakshmi 2 kg rice 150 udhaar").amount, 150)
        self.assertEqual(validate(cmd, "Lakshmi 2 kg rice udhaar").intent, "unknown")
        self.assertEqual(validate(cmd.model_copy(update={"amount": 100}), "Lakshmi nooru udhaar").warning,
                         "amount_from_transcript")

    # ---------------------------------------------------------------- reminders and clock
    def test_part_payment_keeps_the_reminder_tone(self):
        ramesh = self.customers["Ramesh|Gandhi Street"]["id"]
        self.client.post("/api/demo/fast-forward", json={"days": 2})  # first reminder; the next one is tone 2
        reply = self.say("Ramesh paid 100 cash")
        if reply["pending"]["state"] == "awaiting_choice":  # two customers are named Ramesh
            self.client.post(f"/api/actions/{reply['pending']['id']}/choose", json={"customer_id": ramesh})
        self.client.post(f"/api/actions/{reply['pending']['id']}/confirm", json={})
        from app.db import SessionLocal
        from app.models import Reminder
        with SessionLocal() as db:
            nxt = db.query(Reminder).filter_by(customer_id=ramesh, status="scheduled").one()
        self.assertEqual(nxt.tone_level, 2)

    def test_failed_send_is_not_counted_as_sent(self):
        ravi = self.customers["Ravi|"]["id"]
        settings.messaging_channel = "whatsapp"  # no token configured, so every send fails
        try:
            response = self.client.post(f"/api/customers/{ravi}/remind", json={})
            self.assertEqual(response.status_code, 400)
            self.assertIn("Couldn't send", response.json()["detail"])
            forwarded = self.client.post("/api/demo/fast-forward", json={"days": 2}).json()
            self.assertEqual(forwarded["reminders_sent"], 0)
        finally:
            settings.messaging_channel = "simulator"
        # Nothing was marked sent, so the merchant can still send one now.
        self.assertEqual(self.client.post(f"/api/customers/{ravi}/remind", json={}).status_code, 200)

    def test_demo_clock_survives_a_restart(self):
        clock.advance(3)
        self.assertAlmostEqual(clock._load().total_seconds(), 3 * 86400)


    # ---------------------------------------------------------------- screens that already know the customer
    def test_customer_page_never_asks_which_ramesh(self):
        teacher = self.customers["Ramesh|Teacher"]["id"]
        street = self.customers["Ramesh|Gandhi Street"]["id"]
        self.assertEqual(self.say("Ramesh paid 300 cash")["pending"]["state"], "awaiting_choice")
        reply = self.client.post("/api/command", json={"text": "Ramesh paid 300 cash", "lang": "en-IN",
                                                       "customer_id": street}).json()
        self.assertEqual(reply["pending"]["state"], "awaiting_confirm")
        self.assertEqual(reply["pending"]["customer"]["id"], street)
        self.client.post(f"/api/actions/{reply['pending']['id']}/confirm", json={})
        self.assertEqual(self.balance(street), 500)
        self.assertEqual(self.balance(teacher), 0)

    def test_add_customer_with_nothing_owed(self):
        added = self.client.post("/api/customers", json={"name": "  Selvi ", "phone": "9123456780"}).json()
        self.assertEqual((added["name"], added["balance"]), ("Selvi", 0))
        again = self.client.post("/api/customers", json={"name": "Someone", "phone": "+91 91234 56780"})
        self.assertEqual(again.status_code, 400)
        self.assertEqual(self.client.post("/api/customers", json={"name": " "}).status_code, 400)

    def test_answers_have_no_english_inside_other_languages(self):
        for lang, phrase in (("ta-IN", "40 நாட்களாக"), ("hi-IN", "40 दिन से")):
            reply = self.client.post("/api/command", json={"text": "Who owes me money?", "lang": lang}).json()
            self.assertIn(phrase, reply["reply_text"])
            self.assertNotIn("days", reply["reply_text"])


    # ---------------------------------------------------------------- editing a customer
    def test_edit_customer_name_phone_and_identifier(self):
        ravi = self.customers["Ravi|"]["id"]
        r = self.client.patch(f"/api/customers/{ravi}", json={"name": "ravi kumar", "phone": "9123456789",
                                                              "note": "Temple Street"}).json()
        self.assertEqual((r["name"], r["phone"], r["note"]), ("Ravi Kumar", "9123456789", "Temple Street"))
        reply = self.say("Ravi paid 100 cash")  # the old name still matches, kept as an alias
        self.assertEqual(reply["pending"]["customer"]["id"], ravi)

    def test_phone_already_used_by_another_customer_is_refused(self):
        ravi, suresh = self.customers["Ravi|"]["id"], self.customers["Suresh|"]["id"]
        self.client.patch(f"/api/customers/{ravi}", json={"phone": "9123456789"})
        r = self.client.patch(f"/api/customers/{suresh}", json={"phone": "+91 91234 56789"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.patch(f"/api/customers/{suresh}", json={"name": " "}).status_code, 400)

    def test_setting_the_balance_adds_an_adjustment_and_keeps_history(self):
        ramesh = self.customers["Ramesh|Gandhi Street"]["id"]  # owes 800
        before = len(self.client.get(f"/api/customers/{ramesh}/ledger").json()["entries"])
        r = self.client.patch(f"/api/customers/{ramesh}", json={"balance": 500}).json()
        self.assertEqual(r["balance"], 500)
        entries = self.client.get(f"/api/customers/{ramesh}/ledger").json()["entries"]
        self.assertEqual(len(entries), before + 1)
        self.assertEqual((entries[0]["type"], entries[0]["change"]), ("adjustment", -300))
        self.client.patch(f"/api/customers/{ramesh}", json={"balance": 500})  # same amount: no new row
        self.assertEqual(len(self.client.get(f"/api/customers/{ramesh}/ledger").json()["entries"]), before + 1)
        self.assertEqual(self.client.patch(f"/api/customers/{ramesh}", json={"balance": -5}).status_code, 400)
        r = self.client.patch(f"/api/customers/{ramesh}", json={"balance": 0}).json()
        self.assertEqual((r["balance"], r["next_reminder_at"]), (0, None))


if __name__ == "__main__":
    unittest.main()
