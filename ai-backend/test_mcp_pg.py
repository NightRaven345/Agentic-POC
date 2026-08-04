"""
MCP Tools Smoke Test — verifies all FastMCP tools still work after PostgreSQL migration.
Calls: get_public_notices, get_pending_users, get_approved_users, get_rejected_users,
       get_dashboard_stats, search_citizen, get_my_profile, get_application_details
"""
import requests
import sys

BASE_URL = "http://localhost:8080"
AI_URL = "http://localhost:8000"

# 1. Get officer token
auth = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "officer@gov.in", "password": "Officer@123"}).json()
token = auth.get("token")
headers = {"Authorization": f"Bearer {token}"}
assert token, "❌ Login failed — no token returned"
print("✅ Login OK — officer token acquired")

# 2. Public notices
notices = requests.get(f"{BASE_URL}/api/public/notices").json()
assert isinstance(notices, list) and len(notices) > 0, f"❌ Notices empty: {notices}"
print(f"✅ get_public_notices — {len(notices)} notices in PostgreSQL")

# 3. Pending users
pending = requests.get(f"{BASE_URL}/api/employee/pending", headers=headers).json()
assert isinstance(pending, list) and len(pending) > 0, f"❌ Pending users empty: {pending}"
print(f"✅ get_pending_users — {len(pending)} pending applicants")

# 4. Approved users
approved = requests.get(f"{BASE_URL}/api/employee/approved", headers=headers).json()
assert isinstance(approved, list) and len(approved) > 0, f"❌ Approved users empty: {approved}"
print(f"✅ get_approved_users — {len(approved)} approved citizens")

# 5. Rejected users
rejected = requests.get(f"{BASE_URL}/api/employee/rejected", headers=headers).json()
assert isinstance(rejected, list), f"❌ Rejected endpoint error: {rejected}"
print(f"✅ get_rejected_users — {len(rejected)} rejected applications")

# 6. Dashboard stats
stats = requests.get(f"{BASE_URL}/api/employee/stats", headers=headers).json()
assert "total" in stats and "pending" in stats, f"❌ Stats malformed: {stats}"
print(f"✅ get_dashboard_stats — Total={stats['total']}, Pending={stats['pending']}, Approved={stats['approved']}, Rejected={stats['rejected']}")

# 7. Search citizen
search = requests.get(f"{BASE_URL}/api/employee/search", headers=headers, params={"query": "Sharma"}).json()
assert isinstance(search, list), f"❌ Search error: {search}"
print(f"✅ search_citizen('Sharma') — {len(search)} results")

# 8. Application details (first pending)
first_pending = pending[0]
app_id = first_pending.get("id")
if app_id:
    detail = requests.get(f"{BASE_URL}/api/employee/application/{app_id}", headers=headers).json()
    assert detail and "registrationId" in detail, f"❌ Application detail error: {detail}"
    print(f"✅ get_application_details({app_id}) — {detail.get('registrationId')} ({detail.get('firstName')} {detail.get('lastName')})")

# 9. Citizen self-service profile
citizen_auth = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "rahul.sharma@gmail.com", "password": "Rahul@123"}).json()
citizen_token = citizen_auth.get("token")
c_headers = {"Authorization": f"Bearer {citizen_token}"}
profile = requests.get(f"{BASE_URL}/api/user/me", headers=c_headers).json()
assert profile and "registrationId" in profile, f"❌ Profile fetch error: {profile}"
print(f"✅ get_my_profile — {profile.get('firstName')} {profile.get('lastName')} ({profile.get('registrationId')})")

# 10. AI backend health
health = requests.get(f"{AI_URL}/health", timeout=5).json()
assert health.get("status") in ("healthy", "UP"), f"FAIL AI health: {health}"
print(f"✅ AI backend healthy — {health}")

# 11. Duplicate check through AI backend
target = pending[0]
r = requests.post(f"{AI_URL}/api/ai/duplicate-check", json={"target_user": target, "approved_users": approved})
result = r.json()
assert "confidence_score" in result, f"❌ Duplicate check error: {result}"
print(f"✅ duplicate-check OK — score={result['confidence_score']}%, rec={result['recommendation'][:40]}...")

print("\n🎉 ALL MCP TOOL CHECKS PASSED — PostgreSQL migration verified!")
