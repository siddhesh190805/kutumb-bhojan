import unittest
from fastapi.testclient import TestClient
import sys
import os

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.index import app

class TestFastApiSpike(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_get_api_hello_returns_expected_payload(self):
        response = self.client.get("/api/hello")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/json")
        data = response.json()
        self.assertEqual(data.get("ok"), True)
        self.assertEqual(data.get("service"), "kutumb-bhojan-api")
        self.assertEqual(data.get("backend"), "fastapi")

    def test_get_root_fallback_returns_expected_payload(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("ok"), True)
        self.assertEqual(data.get("backend"), "fastapi")

    def test_unsupported_method_returns_405(self):
        response = self.client.post("/api/hello")
        self.assertEqual(response.status_code, 405)


if __name__ == "__main__":
    unittest.main()
