import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from api import index


class AppTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(index.app)

    def test_serves_frontend_and_health_check(self) -> None:
        page = self.client.get("/")
        health = self.client.get("/api/health")

        self.assertEqual(page.status_code, 200)
        self.assertIn("High Low Buffalo", page.text)
        self.assertEqual(health.json(), {"status": "ok"})

    def test_private_entries_require_a_session(self) -> None:
        response = self.client.get("/api/entries")

        self.assertEqual(response.status_code, 401)

    def test_signup_sets_a_http_only_session_cookie(self) -> None:
        async def fake_supabase_request(method: str, endpoint: str, **kwargs: object) -> httpx.Response:
            request = httpx.Request(method, f"https://example.test{endpoint}")
            return httpx.Response(
                200,
                request=request,
                json={
                    "access_token": "test-token",
                    "expires_in": 1800,
                    "user": {"id": "user-1", "email": "hello@example.com"},
                },
            )

        with patch.object(index, "supabase_request", side_effect=fake_supabase_request):
            response = self.client.post(
                "/api/auth/signup",
                json={"email": "hello@example.com", "password": "password123"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["email"], "hello@example.com")
        self.assertIn("httponly", response.headers["set-cookie"].lower())


if __name__ == "__main__":
    unittest.main()
