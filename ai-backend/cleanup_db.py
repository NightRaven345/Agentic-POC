import psycopg2

def cleanup_approval_stage():
    conn = psycopg2.connect(
        dbname="govportal",
        user="postgres",
        password="Ag0301//",
        host="localhost",
        port=5432
    )
    cur = conn.cursor()

    # Clean up non-approved users: set approval_stage = 'Initial Review'
    cur.execute("""
        UPDATE users 
        SET approval_stage = 'Initial Review' 
        WHERE status != 'APPROVED' OR status IS NULL;
    """)
    conn.commit()

    # Ensure approved users have 'Approved & Active'
    cur.execute("""
        UPDATE users 
        SET approval_stage = 'Approved & Active' 
        WHERE status = 'APPROVED' AND role = 'ROLE_USER';
    """)
    conn.commit()

    cur.execute("SELECT status, approval_stage, COUNT(*) FROM users GROUP BY status, approval_stage ORDER BY status;")
    results = cur.fetchall()

    print("--- UPDATED DATABASE APPROVAL_STAGE VALUES ---")
    for r in results:
        print(f"Status: {r[0]} | Approval Stage: {r[1]} | Count: {r[2]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    cleanup_approval_stage()
