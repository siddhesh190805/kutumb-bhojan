import unittest
from fastapi.testclient import TestClient
import sys
import os

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.hello import app as hello_app
from api.index import app as index_app

class TestFastApiSpike(unittest.TestCase):
    def setUp(self):
        self.hello_client = TestClient(hello_app)
        self.index_client = TestClient(index_app)

    def test_hello_app_get_api_hello(self):
        response = self.hello_client.get("/api/hello")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/json")
        data = response.json()
        self.assertEqual(data.get("ok"), True)
        self.assertEqual(data.get("service"), "kutumb-bhojan-api")
        self.assertEqual(data.get("backend"), "fastapi")

    def test_hello_app_get_root_fallback(self):
        response = self.hello_client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("ok"), True)
        self.assertEqual(data.get("backend"), "fastapi")

    def test_hello_app_unsupported_method_returns_405(self):
        response = self.hello_client.post("/api/hello")
        self.assertEqual(response.status_code, 405)

    def test_index_app_get_api(self):
        response = self.index_client.get("/api")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("ok"), True)
        self.assertEqual(data.get("backend"), "fastapi")


if __name__ == "__main__":
    unittest.main()
