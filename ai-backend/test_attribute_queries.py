import requests
import json

BASE_URL = "http://localhost:8080"
AI_URL = "http://localhost:8000"

# 1. Login as officer
auth = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "officer@gov.in", "password": "Officer@123"}).json()
token = auth.get("token")

print("--- TESTING OFFICER ATTRIBUTE QUERIES ---")

test_cases = [
    {
        "name": "Query address of Rahul Sharma by name",
        "message": "what is the address of Rahul Sharma?",
        "context": None
    },
    {
        "name": "Query PAN of Rahul Sharma by name",
        "message": "what was the pan of Rahul Sharma?",
        "context": None
    },
    {
        "name": "Query address of active applicant context (Priya Verma)",
        "message": "what is the address of this guy?",
        "context": {
            "firstName": "Priya",
            "lastName": "Verma",
            "pan": "XYZPS9876Q",
            "phone": "9123456789",
            "registrationId": "USR-1043",
            "address": "House 12, Park Street, Kolkata",
            "district": "Kolkata",
            "state": "West Bengal",
            "pin": "700016"
        }
    },
    {
        "name": "Query PAN of active applicant context (Priya Verma)",
        "message": "what was the pan of this applicant?",
        "context": {
            "firstName": "Priya",
            "lastName": "Verma",
            "pan": "XYZPS9876Q",
            "phone": "9123456789",
            "registrationId": "USR-1043"
        }
    }
]

for test in test_cases:
    print(f"\n👉 Test: {test['name']}")
    res = requests.post(
        f"{AI_URL}/api/ai/chat",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "message": test["message"],
            "role": "ROLE_EMPLOYEE",
            "active_app_context": test["context"]
        }
    ).json()

    print(f"Intent Classified: {res.get('intent')}")
    print(f"Tools Used: {res.get('tools_used')}")
    print(f"Response Snippet:\n{res.get('response', '')[:300]}")
    print("-" * 50)
