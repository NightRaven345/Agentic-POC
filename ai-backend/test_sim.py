import requests

# 1. Login as officer to get JWT token
auth_resp = requests.post('http://localhost:8080/api/auth/login', json={'username': 'officer@gov.in', 'password': 'Officer@123'}).json()
token = auth_resp.get('token')
headers = {'Authorization': f'Bearer {token}'}

# 2. Fetch approved and pending users with token
approved = requests.get('http://localhost:8080/api/employee/approved', headers=headers).json()
pending = requests.get('http://localhost:8080/api/employee/pending', headers=headers).json()

t30 = next((p for p in pending if 'audit30' in str(p.get('email', ''))), None)
t50 = next((p for p in pending if 'audit50' in str(p.get('email', ''))), None)
t75 = next((p for p in pending if 'audit75' in str(p.get('email', ''))), None)

for label, target in [('Target ~30%', t30), ('Target ~50%', t50), ('Target ~75%', t75)]:
    if not target:
        print(f"=== {label} === NOT FOUND")
        continue
    r = requests.post('http://localhost:8000/api/ai/duplicate-check', json={'target_user': target, 'approved_users': approved})
    res = r.json()
    matched = res.get('matched_user') or {}
    print('===', label, '===')
    print('Reg ID:', target.get('registrationId'))
    print('Name:', target.get('firstName'), target.get('lastName'))
    print('Score:', res.get('confidence_score'), '%')
    print('Matched:', matched.get('fullName', 'None'), f"({matched.get('registrationId', 'N/A')})")
    print('Rec:', res.get('recommendation'))
    print()
