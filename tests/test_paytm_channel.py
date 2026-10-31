"""Customers can get messages on WhatsApp or inside the Paytm app (mock page /paytm). Run: python -m unittest discover tests"""
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


class PaytmChannelTests(unittest.TestCase):
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
        self.by_name = {c["name"] + "|" + c["note"]: c for c in self.client.get("/api/state").json()["customers"]}

    def test_seed_puts_ravi_on_paytm_and_others_on_whatsapp(self):
        self.assertEqual(self.by_name["Ravi|"]["channel"], "paytm")
        self.assertEqual(self.by_name["Ramesh|Gandhi Street"]["channel"], "whatsapp")

    def test_channel_is_editable_and_messages_follow_it(self):
        ramesh = self.by_name["Ramesh|Gandhi Street"]["id"]
        r = self.client.patch(f"/api/customers/{ramesh}", json={"channel": "paytm"})
        self.assertEqual(r.json()["channel"], "paytm")
        self.client.post(f"/api/customers/{ramesh}/remind")
        view = self.client.get(f"/api/customer-view/{ramesh}").json()
        rem = [m for m in view["messages"] if m["kind"] == "reminder"][-1]
        self.assertEqual(rem["channel"], "paytm")
        self.assertEqual(rem["status"], "delivered")
        self.assertTrue(rem["link_url"])  # Pay in the Paytm sheet uses the same link + webhook
        self.assertEqual(self.client.patch(f"/api/customers/{ramesh}", json={"channel": "fax"}).json()["channel"], "paytm")  # ignored

    def test_paytm_page_is_served_and_pay_flow_works(self):
        page = self.client.get("/paytm?id=1")
        self.assertEqual(page.status_code, 200)
        self.assertIn("/static/paytm.js", page.text)
        ravi = self.by_name["Ravi|"]["id"]
        self.client.post(f"/api/customers/{ravi}/remind")
        view = self.client.get(f"/api/customer-view/{ravi}").json()
        link = [m for m in view["messages"] if m["kind"] == "reminder"][-1]["link_url"].rsplit("/", 1)[-1]
        info = self.client.get(f"/api/pay/{link}").json()
        self.assertEqual(info["amount"], 290)
        r = self.client.post(f"/api/pay/{link}/simulate", json={"amount": 100}).json()
        self.assertEqual(r["balance"], 190)

    def test_amount_wrong_from_paytm_page_pauses_reminders(self):
        ravi = self.by_name["Ravi|"]["id"]
        self.client.post(f"/api/customers/{ravi}/remind")
        r = self.client.post(f"/api/customer-view/{ravi}/reply", json={"button_id": "flag:balance", "text": "Amount wrong?"}).json()
        self.assertEqual(r["action"], "balance_flagged")
        state = {c["id"]: c for c in self.client.get("/api/state").json()["customers"]}
        self.assertTrue(state[ravi]["reminders_paused"])


if __name__ == "__main__":
    unittest.main()
