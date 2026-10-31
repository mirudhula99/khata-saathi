"""Server-generated text follows the merchant's language. Run: python -m unittest discover tests"""
import os
import re
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
from app.config import settings  # noqa: E402
from app.i18n import LANGUAGES, NOTIF  # noqa: E402
from app.main import app  # noqa: E402

TAMIL = re.compile(r"[஀-௿]")


class LanguageSwitchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._client_cm = TestClient(app)
        cls.client = cls._client_cm.__enter__()
        cls.client.cookies.set("khata_key", "test-key")

    @classmethod
    def tearDownClass(cls):
        cls._client_cm.__exit__(None, None, None)

    def last_entry(self, customer_id):
        """The id of the customer's newest ledger entry (what a dispute targets)."""
        return self.client.get(f"/api/customers/{customer_id}/ledger").json()["entries"][0]["id"]

    def setUp(self):
        seed.reset_and_seed()
        self.client.patch("/api/merchant", json={"language": "en-IN"})
        self.customers = {c["name"] + "|" + c["note"]: c for c in self.client.get("/api/state").json()["customers"]}
        self.lakshmi = self.customers["Lakshmi|Gandhi Nagar"]["id"]
        self.ramesh = self.customers["Ramesh|Gandhi Street"]["id"]

    def items(self, kind, customer_id):
        data = self.client.get("/api/notifications").json()
        return [i for i in data["items"] if i["kind"] == kind and i["customer_id"] == customer_id]

    def flag_an_entry(self):
        p = self.client.post("/api/command", json={"text": "Lakshmi 150 udhaar rice", "lang": "en-IN"}).json()["pending"]
        self.client.post(f"/api/actions/{p['id']}/confirm", json={"lang": "en-IN"})
        flag = f"dispute:{self.last_entry(self.lakshmi)}"
        self.client.post(f"/api/customer-view/{self.lakshmi}/reply", json={"button_id": flag})

    def test_phrase_tables_cover_every_language(self):
        keys = set(NOTIF["en-IN"])
        for lang in LANGUAGES:
            self.assertEqual(set(NOTIF[lang]), keys, lang)

    def test_notifications_follow_the_merchant_language(self):
        self.flag_an_entry()
        task = self.items("flagged", self.lakshmi)[0]
        self.assertIn("flagged", task["title"])
        self.assertEqual(task["action"]["label"], "Resolve")

        r = self.client.patch("/api/merchant", json={"language": "ta-IN"})
        self.assertEqual(r.status_code, 200)
        task = self.items("flagged", self.lakshmi)[0]
        self.assertTrue(TAMIL.search(task["title"]), task["title"])
        self.assertTrue(TAMIL.search(task["body"]), task["body"])
        self.assertTrue(TAMIL.search(task["action"]["label"]))
        self.assertIn("Lakshmi", task["title"])
        self.assertIn("₹150", task["title"])
        self.assertEqual(task["kind"], "flagged")                 # kind/ids never change with the language
        self.assertEqual(task["action"]["to"], f"/khata/{self.lakshmi}")

        # Silent after reminders: an unpaid task, in Tamil too.
        self.client.post("/api/demo/fast-forward", json={"days": 3})
        self.client.post("/api/demo/fast-forward", json={"days": 3})
        unpaid = self.items("unpaid_after_reminder", self.ramesh)
        self.assertEqual(len(unpaid), 1)
        self.assertTrue(TAMIL.search(unpaid[0]["title"]), unpaid[0]["title"])
        self.assertNotIn("hasn't paid", unpaid[0]["title"])

        self.client.patch("/api/merchant", json={"language": "en-IN"})
        task = self.items("flagged", self.lakshmi)[0]
        self.assertFalse(TAMIL.search(task["title"]))
        self.assertIn("flagged", task["title"])
        self.assertIn("hasn't paid", self.items("unpaid_after_reminder", self.ramesh)[0]["title"])

    def test_demo_customers_follow_the_merchant_language(self):
        self.assertTrue(settings.demo_mode)
        preview = self.client.get(f"/api/customers/{self.ramesh}/reminder-preview").json()
        self.assertEqual(preview["language"], "en-IN")
        self.assertIn("Hi Ramesh", preview["text"])

        self.client.patch("/api/merchant", json={"language": "ta-IN"})
        preview = self.client.get(f"/api/customers/{self.ramesh}/reminder-preview").json()
        self.assertEqual(preview["language"], "ta-IN")
        self.assertTrue(TAMIL.search(preview["text"]), preview["text"])
        self.assertNotIn("Hi Ramesh", preview["text"])
        self.assertIn("₹800", preview["text"])
        self.assertIn("STOP", preview["text"])                     # the keyword stays
        # Every seeded customer switched, and the customer phone page knows the language.
        languages = {c["language"] for c in self.client.get("/api/state").json()["customers"]}
        self.assertEqual(languages, {"ta-IN"})
        view = self.client.get(f"/api/customer-view/{self.ramesh}").json()
        self.assertEqual(view["customer"]["language"], "ta-IN")
        # A new message goes out in Tamil; the pay page gets the language too.
        self.client.post(f"/api/customers/{self.ramesh}/remind")
        view = self.client.get(f"/api/customer-view/{self.ramesh}").json()
        rem = [m for m in view["messages"] if m["kind"] == "reminder"][-1]
        self.assertTrue(TAMIL.search(rem["body"]))
        link_id = rem["link_url"].rsplit("/", 1)[-1]
        self.assertEqual(self.client.get(f"/api/pay/{link_id}").json()["language"], "ta-IN")

        self.client.patch("/api/merchant", json={"language": "en-IN"})
        preview = self.client.get(f"/api/customers/{self.ramesh}/reminder-preview").json()
        self.assertEqual(preview["language"], "en-IN")
        self.assertIn("Hi Ramesh", preview["text"])
        # The Tamil reminder that already went out stays as it was sent.
        view = self.client.get(f"/api/customer-view/{self.ramesh}").json()
        self.assertTrue(TAMIL.search([m for m in view["messages"] if m["kind"] == "reminder"][-1]["body"]))

    def test_production_keeps_each_customer_language(self):
        settings.demo_mode = False
        try:
            self.client.patch("/api/merchant", json={"language": "hi-IN"})
            languages = {c["language"] for c in self.client.get("/api/state").json()["customers"]}
            self.assertEqual(languages, {"en-IN"})
        finally:
            settings.demo_mode = True

    def test_join_page_info_carries_the_merchant_language(self):
        self.client.patch("/api/merchant", json={"language": "kn-IN"})
        self.assertEqual(self.client.get("/api/join/1").json()["language"], "kn-IN")


if __name__ == "__main__":
    unittest.main()
