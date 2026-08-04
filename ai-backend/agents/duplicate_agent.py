"""
AI Microservice Agent — Multi-Attribute Duplicate Detection Engine
Compares a pending application against all approved citizens using real-time
multi-attribute scoring (PAN, Phone, Name similarity, DOB, Address, Email, Organization).
Displays accurate confidence scores (<10% or >=10%). Only attaches/displays matched_user record if score >= 10%.
"""

import json
import re
from typing import Dict, Any, List, Optional
from difflib import SequenceMatcher


def calculate_string_similarity(s1: str, s2: str) -> float:
    """Computes normalized Levenshtein-style ratio between 0.0 and 1.0."""
    if not s1 or not s2:
        return 0.0
    return SequenceMatcher(None, s1.lower().strip(), s2.lower().strip()).ratio()


def find_best_candidate(
    target: Dict[str, Any],
    approved_list: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    Scans all approved citizens and selects the candidate with the highest similarity score.
    Applies exact-match rules for PAN and Phone, plus fuzzy matching for Name, DOB, Address, and Email.
    """
    best_match = None
    best_score = 0.0
    best_evidence = []
    best_field_table = []

    target_pan = (target.get("pan") or "").upper().strip()
    target_phone = re.sub(r"\D", "", target.get("phone") or "")
    target_email = (target.get("email") or "").lower().strip()
    target_dob = (target.get("dob") or "").strip()

    t_first = (target.get("firstName") or "").strip()
    t_last = (target.get("lastName") or "").strip()
    target_name = f"{t_first} {t_last}".strip()

    target_addr = (target.get("address") or "").strip()
    target_org = (target.get("organization") or "").strip()

    for app in approved_list:
        score = 0.0
        evidence = []
        field_table = []

        app_pan = (app.get("pan") or "").upper().strip()
        app_phone = re.sub(r"\D", "", app.get("phone") or "")
        app_email = (app.get("email") or "").lower().strip()
        app_dob = (app.get("dob") or "").strip()

        a_first = (app.get("firstName") or "").strip()
        a_last = (app.get("lastName") or "").strip()
        app_name = f"{a_first} {a_last}".strip()
        if not app_name.strip() and app.get("fullName"):
            app_name = app.get("fullName").strip()

        app_addr = (app.get("address") or "").strip()
        app_org = (app.get("organization") or "").strip()

        # 1. PAN Match (Weight: 45 points)
        if target_pan and app_pan and target_pan == app_pan:
            score += 45.0
            evidence.append(f"EXACT PAN Card Match: '{target_pan}'")
            field_table.append(f"PAN Card: MATCH ({target_pan})")
        else:
            field_table.append(f"PAN Card: Different ({target_pan} vs {app_pan})")

        # 2. Phone Match (Weight: 25 points)
        if target_phone and app_phone and target_phone == app_phone:
            score += 25.0
            evidence.append(f"EXACT Mobile Phone Match: '{target_phone}'")
            field_table.append(f"Phone Number: MATCH ({target_phone})")
        else:
            field_table.append(f"Phone Number: Different ({target_phone} vs {app_phone})")

        # 3. Email Match (Weight: 15 points)
        if target_email and app_email and target_email == app_email:
            score += 15.0
            evidence.append(f"EXACT Email Match: '{target_email}'")
            field_table.append(f"Email: MATCH ({target_email})")

        # 4. Full Name Fuzzy Match (Weight: up to 15 points)
        name_sim = calculate_string_similarity(target_name, app_name)
        if name_sim >= 0.85:
            score += 15.0
            evidence.append(f"High Name Similarity ({int(name_sim*100)}%): '{target_name}' vs '{app_name}'")
            field_table.append(f"Full Name: Highly Similar ({int(name_sim*100)}%)")
        elif name_sim >= 0.65:
            score += 8.0
            evidence.append(f"Moderate Name Similarity ({int(name_sim*100)}%): '{target_name}' vs '{app_name}'")
            field_table.append(f"Full Name: Moderately Similar ({int(name_sim*100)}%)")

        # 5. DOB Match (Weight: 10 points)
        if target_dob and app_dob and target_dob == app_dob:
            score += 10.0
            evidence.append(f"EXACT Date of Birth Match: '{target_dob}'")
            field_table.append(f"Date of Birth: MATCH ({target_dob})")

        # 6. Address Fuzzy Match (Weight: up to 10 points)
        addr_sim = calculate_string_similarity(target_addr, app_addr)
        if addr_sim >= 0.75:
            score += 10.0
            evidence.append(f"Address Match ({int(addr_sim*100)}%): '{target_addr}' vs '{app_addr}'")

        # Cap score at 99.0
        score = min(99.0, score)

        if score > best_score:
            best_score = score
            best_match = app
            best_evidence = evidence
            best_field_table = field_table

    if not best_match:
        return None

    return {
        "matched_user": {
            "id": best_match.get("id"),
            "fullName": f"{best_match.get('firstName', '')} {best_match.get('lastName', '')}".strip() or best_match.get("username"),
            "registrationId": best_match.get("registrationId", "N/A"),
            "pan": best_match.get("pan", "N/A"),
            "phone": best_match.get("phone", "N/A"),
            "email": best_match.get("email", "N/A"),
            "dob": best_match.get("dob", "N/A"),
            "address": best_match.get("address", "N/A"),
            "organization": best_match.get("organization", "N/A")
        },
        "algorithmic_pre_score": round(best_score, 1),
        "evidence_points": best_evidence,
        "field_table": best_field_table
    }


def build_llm_duplicate_prompt(target: Dict[str, Any], candidate: Dict[str, Any]) -> str:
    """Formats applicant and candidate data into structured prompt for LLM evaluation."""
    matched = candidate["matched_user"]
    field_table = candidate["field_table"]
    evidence = candidate["evidence_points"]
    algo_score = candidate["algorithmic_pre_score"]

    t_name = f"{target.get('firstName', '')} {target.get('lastName', '')}".strip() or target.get("name", "Applicant")

    return f"""Analyze potential duplicate registration between the NEW PENDING APPLICATION and an APPROVED CITIZEN RECORD.

=== NEW PENDING APPLICATION ===
Name: {t_name}
Registration ID: {target.get('registrationId', 'N/A')}
PAN Card: {target.get('pan', 'N/A')}
Phone: {target.get('phone', 'N/A')}
Email: {target.get('email', 'N/A')}
DOB: {target.get('dob', 'N/A')}
Address: {target.get('address', 'N/A')}
Organization: {target.get('organization', 'N/A')}

=== CANDIDATE APPROVED CITIZEN RECORD ===
Name: {matched.get('fullName', 'N/A')}
Registration ID: {matched.get('registrationId', 'N/A')}
PAN: {matched.get('pan', 'N/A')}
Phone: {matched.get('phone', 'N/A')}
Email: {matched.get('email', 'N/A')}
DOB: {matched.get('dob', 'N/A')}
Address: {matched.get('address', 'N/A')}
Organization: {matched.get('organization', 'N/A')}

=== FIELD-BY-FIELD COMPARISON ===
{chr(10).join(field_table)}

=== EVIDENCE POINTS ===
{chr(10).join(f'- {e}' for e in evidence) if evidence else '- No strong matches found'}

Algorithmic pre-screening score: {algo_score}%

=== YOUR TASK ===
As an AI fraud analyst, evaluate all evidence and return ONLY valid JSON:
{{
  "confidence_score": <number 0-100 representing DUPLICATE RISK / SIMILARITY SCORE. 0% = completely unique/distinct individuals, 100% = identical duplicate. DO NOT return confidence of uniqueness, return the DUPLICATE SIMILARITY score (0-100)>,
  "recommendation": "<'Likely Duplicate Registration' | 'Potential Partial Duplicate — Manual Review Advised' | 'Unique Application — Standard Processing Recommended'>",
  "reasoning": "<2-3 sentence explanation>",
  "key_evidence": ["<evidence 1>", "<evidence 2>"],
  "has_duplicate": <true if confidence_score >= 70 else false>
}}"""


def parse_llm_duplicate_response(llm_content: str) -> Optional[Dict[str, Any]]:
    """Extracts JSON response from LLM output."""
    if not llm_content:
        return None
    content = re.sub(r'```(?:json)?\s*', '', llm_content).strip()
    content = re.sub(r'```\s*$', '', content).strip()
    match = re.search(r'\{[\s\S]*\}', content)
    if match:
        try:
            parsed = json.loads(match.group())
            if "confidence_score" in parsed and "recommendation" in parsed:
                return parsed
        except json.JSONDecodeError:
            pass
    return None


def run_duplicate_detection(
    target_user: Dict[str, Any],
    approved_users: List[Dict[str, Any]],
    llm_client=None
) -> Dict[str, Any]:
    """
    Full AI duplicate detection pipeline.
    Shows exact calculated confidence score.
    Only attaches matched_user candidate if confidence_score >= 10.0%.
    Automatically corrects inverted score if LLM returned confidence of uniqueness instead of duplicate risk.
    """

    if not approved_users:
        return {
            "has_duplicate": False,
            "confidence_score": 0.0,
            "recommendation": "Unique Registration — Clear for Approval",
            "reasoning": "The system has no approved citizen records to compare this application against. Standard processing recommended.",
            "key_evidence": ["No approved citizens found in database for comparison"],
            "matched_user": None,
            "analysis_source": "no_data"
        }

    candidate = find_best_candidate(target_user, approved_users)

    if not candidate:
        return {
            "has_duplicate": False,
            "confidence_score": 0.0,
            "recommendation": "Unique Application — Clear for Approval",
            "reasoning": "No matching records found in database.",
            "key_evidence": ["✓ PAN card is unique in database", "✓ Phone number has no matches", "✓ No address or name similarity detected"],
            "matched_user": None,
            "analysis_source": "algorithmic_clean"
        }

    algo_score = candidate["algorithmic_pre_score"]

    llm_result = None
    if llm_client is not None and algo_score >= 5.0:
        try:
            system_prompt = "You are an AI duplicate detection analyst for a government portal. Respond ONLY with valid JSON."
            user_prompt = build_llm_duplicate_prompt(target_user, candidate)
            llm_res = llm_client.generate(system_prompt, user_prompt, temperature=0.1)

            if llm_res.get("success"):
                llm_result = parse_llm_duplicate_response(llm_res["content"])
        except Exception as e:
            print(f"[DuplicateAgent] LLM call failed: {e}")

    # Determine final confidence score accurately
    if llm_result:
        raw_score = round(float(llm_result.get("confidence_score", algo_score)), 1)
        evidence = llm_result.get("key_evidence", candidate["evidence_points"])
        rec = llm_result.get("recommendation", "Unique Application — Standard Processing Recommended")
        reasoning = llm_result.get("reasoning", "")
        source = "llm"

        # SANITY CHECK: Fix inverted score if LLM returned "98% confident it's Unique" instead of "2% duplicate risk"
        is_unique_rec = "unique" in rec.lower() or not llm_result.get("has_duplicate", True)
        if is_unique_rec and raw_score > 50.0:
            raw_score = round(max(0.0, 100.0 - raw_score), 1)

        # Calibrate score to closely match pre-screening algorithmic similarity
        score = round((algo_score * 0.85) + (raw_score * 0.15), 1)
    else:
        score = algo_score
        evidence = candidate["evidence_points"] or ["✓ No significant matching fields detected."]
        reasoning = f"Algorithmic field comparison against {len(approved_users)} approved record(s)."
        source = "algorithmic_fallback"

        if score >= 70:
            rec = "Likely Duplicate Registration"
        elif score >= 40:
            rec = "Potential Partial Duplicate — Manual Review Advised"
        else:
            rec = "Unique Application — Standard Processing Recommended"

    # CRITICAL: Matched record is ONLY attached/shown if confidence score >= 10.0%
    is_valid_match = score >= 10.0
    matched_record = candidate["matched_user"] if is_valid_match else None

    return {
        "has_duplicate": score >= 70.0,
        "confidence_score": score,
        "recommendation": rec if is_valid_match else "Unique Application — Clear for Approval",
        "reasoning": reasoning if reasoning else f"Low similarity detected ({score}% match, below 10% threshold). Application is considered unique.",
        "key_evidence": evidence,
        "reasons": evidence,
        "matched_user": matched_record,
        "algorithmic_pre_score": algo_score,
        "analysis_source": source
    }
