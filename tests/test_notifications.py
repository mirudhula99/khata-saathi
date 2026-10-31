"""Notifications are derived from the ledger. Run: python -m unittest discover tests"""
import os
import tempfile
import unittest

_tmp = tempfile.mkdtemp()
os.environ.update({
    "DATABASE_URL": f"sqlite:///{_tmp}/test.db", "SARVAM_API_KEY": "", "LLM_API_KEY": "",
    "SCHEDULER_ENABLED": "false", "MERCHANT_LANGUAGE": "en-IN", "QUIET_HOURS": "",
    "MERCHANT_KEY": "test-key", "CLOCK_FILE": f"{_tmp}/clock_offset.txt", "WHATSAPP_APP_SECRET": "",
})

from fastapi.testclient import TestClient  # noqa: E402

from app import seed  # noqa: E402
from app.main import app  # noqa: E402


class NotificationTests(unittest.TestCase):
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
        self.customers = {c["name"] + "|" + c["note"]: c for c in self.client.get("/api/state").json()["customers"]}
        self.lakshmi = self.customers["Lakshmi|Gandhi Nagar"]["id"]
        self.ramesh = self.customers["Ramesh|Gandhi Street"]["id"]

    def notifications(self):
        r = self.client.get("/api/notifications")
        self.assertEqual(r.status_code, 200)
        return r.json()

    def kinds(self, data, customer_id=None):
        return [i["kind"] for i in data["items"] if customer_id is None or i["customer_id"] == customer_id]

    def udhaar(self, text):
        p = self.client.post("/api/command", json={"text": text, "lang": "en-IN"}).json()["pending"]
        self.client.post(f"/api/actions/{p['id']}/confirm", json={"lang": "en-IN"})

    def test_fresh_seed_has_no_tasks(self):
        data = self.notifications()
        self.assertEqual(data["counts"].get("action", 0), 0)
        # Seeded reminders are due within a day, so they show as upcoming.
        self.assertIn("reminder_due", self.kinds(data))

    def test_flag_creates_a_task_and_resolving_clears_it(self):
        self.udhaar("Lakshmi 150 udhaar rice")
        view = self.client.get(f"/api/customer-view/{self.lakshmi}").json()
        note = [m for m in view["messages"] if m["kind"] == "credit_note"][-1]
        flag = next(b["id"] for b in note["buttons"] if b["id"].startswith("dispute:"))
        self.client.post(f"/api/customer-view/{self.lakshmi}/reply", json={"button_id": flag})
        data = self.notifications()
        flagged = [i for i in data["items"] if i["kind"] == "flagged" and i["customer_id"] == self.lakshmi]
        self.assertEqual(len(flagged), 1)
        self.assertTrue(flagged[0]["urgent"])
        self.assertEqual(flagged[0]["action"]["to"], f"/khata/{self.lakshmi}")
        entry_id = int(flag.split(":")[1])
        self.client.post(f"/api/entries/{entry_id}/resolve", json={"action": "keep"})
        self.assertNotIn("flagged", self.kinds(self.notifications(), self.lakshmi))

    def test_payment_shows_as_money_in_and_settled(self):
        self.udhaar("Lakshmi 150 udhaar rice")
        p = self.client.post("/api/command", json={"text": "Ask Lakshmi for 150", "lang": "en-IN"}).json()["pending"]
        self.client.post(f"/api/actions/{p['id']}/confirm", json={"lang": "en-IN"})
        view = self.client.get(f"/api/customer-view/{self.lakshmi}").json()
        link = [m for m in view["messages"] if m["kind"] == "payment_request"][-1]["link_url"].rsplit("/", 1)[-1]
        self.client.post(f"/api/pay/{link}/simulate", json={})
        data = self.notifications()
        pay = [i for i in data["items"] if i["kind"] == "payment" and i["customer_id"] == self.lakshmi]
        self.assertEqual(len(pay), 1)
        self.assertIn("settled up", pay[0]["title"])
        self.assertEqual(pay[0]["category"], "payments")

    def test_silent_after_reminders_becomes_a_task(self):
        self.client.post("/api/demo/fast-forward", json={"days": 3})   # seeded reminders go out on day 1
        self.client.post("/api/demo/fast-forward", json={"days": 3})   # now 5 days since the send, past the gap
        data = self.notifications()
        self.assertIn("reminder_sent", self.kinds(data, self.ramesh))
        self.assertIn("unpaid_after_reminder", self.kinds(data, self.ramesh))
        # Actions come first, newest events after.
        cats = [i["category"] for i in data["items"]]
        self.assertEqual(cats, sorted(cats, key=lambda c: 0 if c == "action" else 1))

    def test_reminder_carries_pending_line_buttons_and_merchant_note(self):
        self.client.patch(f"/api/customers/{self.ramesh}", json={"reminder_note": "Also, your Diwali order is ready."})
        self.client.post(f"/api/customers/{self.ramesh}/remind")
        view = self.client.get(f"/api/customer-view/{self.ramesh}").json()
        rem = [m for m in view["messages"] if m["kind"] == "reminder"][-1]
        self.assertIn("800", rem["body"])                      # default sentence with the amount
        self.assertIn("Diwali", rem["body"])                   # merchant's own line
        self.assertIn("STOP", rem["body"])                     # footer stays
        self.assertIn("[payment link]" if False else "http", rem["body"])  # link stays in the text
        self.assertEqual([b["id"] for b in rem["buttons"]], ["flag:balance", "stop"])
        self.assertTrue(rem["link_url"])
        preview = self.client.get(f"/api/customers/{self.ramesh}/reminder-preview").json()["text"]
        self.assertIn("Diwali", preview)
        self.assertIn("[payment link]", preview)

    def test_amount_wrong_button_pauses_and_becomes_a_task(self):
        self.client.post(f"/api/customers/{self.ramesh}/remind")
        r = self.client.post(f"/api/customer-view/{self.ramesh}/reply", json={"button_id": "flag:balance", "text": "Amount wrong?"}).json()
        self.assertEqual(r["action"], "balance_flagged")
        state = {c["id"]: c for c in self.client.get("/api/state").json()["customers"]}
        self.assertTrue(state[self.ramesh]["reminders_paused"])
        data = self.notifications()
        task = [i for i in data["items"] if i["kind"] == "balance_flagged" and i["customer_id"] == self.ramesh]
        self.assertEqual(len(task), 1)
        self.assertTrue(task[0]["urgent"])
        # A payment clears the task.
        p = self.client.post("/api/command", json={"text": "Ramesh paid 800 cash", "lang": "en-IN"}).json()["pending"]
        if p["state"] == "awaiting_choice":
            p = self.client.post(f"/api/actions/{p['id']}/choose", json={"customer_id": self.ramesh}).json()["pending"]
        self.client.post(f"/api/actions/{p['id']}/confirm", json={"lang": "en-IN"})
        self.assertNotIn("balance_flagged", self.kinds(self.notifications(), self.ramesh))

    def test_stop_button_and_balance_text(self):
        self.client.post(f"/api/customers/{self.ramesh}/remind")
        self.client.post(f"/api/customer-view/{self.ramesh}/reply", json={"button_id": "stop", "text": "STOP"})
        state = {c["id"]: c for c in self.client.get("/api/state").json()["customers"]}
        self.assertEqual(state[self.ramesh]["consent"], "opted_out")
        r = self.client.post(f"/api/customer-view/{self.ramesh}/reply", json={"text": "BALANCE"}).json()
        self.assertEqual(r["action"], "statement")
        view = self.client.get(f"/api/customer-view/{self.ramesh}").json()
        self.assertIn("800", view["messages"][-1]["body"])

    def test_join_shows_under_customers(self):
        self.client.post("/api/join/1", json={"name": "Tester", "phone": "9876500001", "language": "ta-IN", "consent": True})
        data = self.notifications()
        joined = [i for i in data["items"] if i["kind"] in ("joined", "new_customer") and i["customer_name"] == "Tester"]
        self.assertTrue(joined)
        self.assertTrue(all(i["category"] == "customers" for i in joined))


if __name__ == "__main__":
    unittest.main()
