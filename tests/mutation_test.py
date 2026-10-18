# Mutation test for Full Time. Run: python3 tests/mutation_test.py
# Each mutant is a small deliberate bug in contracts/full_time.py. The test suite should FAIL for every mutant ("killed").
# A mutant that still passes ("survived") shows something the tests cannot see. A hang counts as caught.
import os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "contracts", "full_time.py")
source = open(SRC).read()
EQUIVALENT = {
    "unknown teams accepted": "a goal for an unknown team would leave the home and away counts short of the score, so the count check rejects it anyway; the explicit check is defence in depth",
    "team totals only need one side right": "once the total number of goals matches the score, a wrong count for one team means the other team's count is wrong too, so the second check can never be the only one to fail",
    "second reading must say finished (redundant)": "same_reading already compares the status, so a reading that is not finished can never match a finished one",
}
MUTANTS = [
    ("goal cap raised", "MAX_GOALS = 20", "MAX_GOALS = 21"),
    ("goal cap exclusive", "0 <= hg <= MAX_GOALS and 0 <= ag <= MAX_GOALS", "0 <= hg < MAX_GOALS and 0 <= ag < MAX_GOALS"),
    ("minute slack raised", "MINUTE_SLACK = 1", "MINUTE_SLACK = 2"),
    ("minute slack removed", "MINUTE_SLACK = 1", "MINUTE_SLACK = 0"),
    ("unknown statuses accepted", 'd.get("status") not in STATUSES', 'd.get("status") in STATUSES'),
    ("an unfinished match with goals accepted", "if not goals else None", "if goals or not goals else None"),
    ("scorers need not match both scores", "len(goals) != hg + ag", "len(goals) != hg"),
    ("home score not checked as a number", "is_int(hg) and is_int(ag) and", "True and is_int(ag) and"),
    ("booleans accepted as numbers", "isinstance(v, int) and not isinstance(v, bool)", "isinstance(v, int)"),
    ("unknown teams accepted", 'g.get("team") not in ("home", "away")', 'g.get("team") not in ("home", "away", "neutral")'),
    ("empty scorer names accepted", "1 <= len(p) <= 40", "0 <= len(p) <= 40"),
    ("scorer name length limit", "1 <= len(p) <= 40", "1 <= len(p) <= 400"),
    ("minute 0 accepted", "1 <= m <= 130", "0 <= m <= 130"),
    ("minute range raised", "1 <= m <= 130", "1 <= m <= 1300"),
    ("team totals only need one side right", '!= hg or sum(1 for g in out if g["team"] == "away") != ag', '!= hg and sum(1 for g in out if g["team"] == "away") != ag'),
    ("goals not put in canonical order", 'out.sort(key=lambda g: (g["minute"], g["team"], surname(g["player"])))', "pass"),
    ("different numbers of goals compared", "if len(a) != len(b):", "if len(a) > len(b):"),
    ("the scoring team ignored", 'x["team"] == y["team"] and', "True and"),
    ("the scorer ignored", 'surname(x["player"]) == surname(y["player"]) and', "True and"),
    ("scorer minutes must match exactly", 'abs(x["minute"] - y["minute"]) <= MINUTE_SLACK', 'abs(x["minute"] - y["minute"]) < MINUTE_SLACK'),
    ("scorer minute tolerance raised", 'abs(x["minute"] - y["minute"]) <= MINUTE_SLACK', 'abs(x["minute"] - y["minute"]) <= MINUTE_SLACK + 5'),
    ("a matched goal can be matched twice", "rest.pop(hit)", "pass"),
    ("a failed reading can agree with a success", 'if not a["ok"] or not b["ok"]:', 'if not a["ok"] and not b["ok"]:'),
    ("two failed readings disagree", 'return a["ok"] == b["ok"]', "return False"),
    ("a failed reading and a success agree", 'return a["ok"] == b["ok"]', "return True"),
    ("status ignored in agreement", 'a["status"] == b["status"] and', "True and"),
    ("home score ignored in agreement", 'a["hg"] == b["hg"] and', "True and"),
    ("away score ignored in agreement", 'a["ag"] == b["ag"] and', "True and"),
    ("scorers ignored in agreement", 'and same_goals(a["goals"], b["goals"])', ""),
    ("page instructions allowed", "if INJ.search(text) is not None:", "if INJ.search(text) is None:"),
    ("only one team name needed", "norm(home) not in n or norm(away) not in n", "norm(home) not in n and norm(away) not in n"),
    ("pattern: ignore instructions", r"ignore\s+(all\s+|any\s+|the\s+)?(previous", r"ignorX\s+(all\s+|any\s+|the\s+)?(previous"),
    ("pattern: disregard", r"disregard\s+(all", r"disregarX\s+(all"),
    ("pattern: you are now", r"you\s+are\s+now\s+", r"yoX\s+are\s+now\s+"),
    ("pattern: system notice", r"\bsystem\s+(notice|message|prompt|override)\b", r"\bsystX\s+(notice|message|prompt|override)\b"),
    ("pattern: new instructions", r"new\s+instructions?\s*:", r"neX\s+instructions?\s*:"),
    ("pattern: planted key", r'\"(status|home_goals|away_goals)\"\s*:', r'\"(statuX|home_goals|away_goals)\"\s*:'),
    ("pattern: record the score", r"\b(record|set)\s+(the\s+)?(final\s+)?(score|result)", r"\b(recorX|set)\s+(the\s+)?(final\s+)?(score|result)"),
    ("pattern: set the result", r"\b(record|set)\s+(the\s+)?(final\s+)?(score|result)", r"\b(record|seX)\s+(the\s+)?(final\s+)?(score|result)"),
    ("page text cap too small", "text[:6000]", "text[:60]"),
    ("plain fetch status check", "r.status == 200", "r.status != 200"),
    ("plain fetch minimum text", "if len(t) > 60:", "if len(t) > 6000:"),
    ("browser fallback removed", 'return gl.nondet.web.render(url, mode="text")', 'return ""'),
    ("bytes body not decoded", "if isinstance(b, bytes):", "if False:"),
    ("scripts kept in page text", "script|style|noscript|template", "style|noscript|template"),
    ("prompt drops the untrusted warning", "UNTRUSTED", "text"),
    ("prompt drops the own goal rule", "an own goal counts for the team that benefits", "goals count"),
    ("prompt drops the status words", "Use not_finished for a live, scheduled or interrupted match and abandoned for a postponed, cancelled or called-off one.", ""),
    ("http reports allowed", 'url.startswith("https://")', 'url.startswith("http")'),
    ("report address length limit", "len(url) > 300", "len(url) > 3000"),
    ("whitespace in addresses allowed", "any(c.isspace() for c in url)", "all(c.isspace() for c in url)"),
    ("one-letter teams allowed", "2 <= len(h) <= 40", "1 <= len(h) <= 40"),
    ("team name length limit", "2 <= len(h) <= 40", "2 <= len(h) <= 400"),
    ("the same team twice allowed", "or norm(h) == norm(a):", "or False:"),
    ("a provisional match can be read again", 'if m.state not in ("open", "disputed"):', 'if m.state not in ("open", "disputed", "provisional"):'),
    ("a disputed match cannot be read again", 'if m.state not in ("open", "disputed"):', 'if m.state not in ("open",):'),
    ("an unfinished match becomes provisional", 'if r["ok"] and r["status"] == "finished":', 'if r["ok"]:'),
    ("the old confirming reading kept after a re-read", 'json.dumps(r), "", "provisional"', 'json.dumps(r), m.second, "provisional"'),
    ("confirm works in any state", 'if m.state != "provisional":', 'if m.state == "provisional":'),
    ("an unreadable second read disputes the match", 'if not r["ok"]:\n      return m.state', 'if False:\n      return m.state'),
    ("second reading must say finished (redundant)", 'if r["status"] == "finished" and same_reading(json.loads(m.first), r):', 'if same_reading(json.loads(m.first), r):'),
    ("a disagreement is never final", 'same_reading(json.loads(m.first), r):', 'True:'),
    ("disputes not counted", 'u256(int(m.disputes) + 1)', 'u256(int(m.disputes) + 0)'),
    ("the last result not recorded", 'm.last = r["status"] if r["ok"] else r["why"]\n    if r["ok"] and', 'if r["ok"] and'),
]

def run(contract_path):
    tmp = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(tmp, "contracts")); shutil.copy(contract_path, os.path.join(tmp, "contracts", "full_time.py"))
        shutil.copytree(HERE, os.path.join(tmp, "tests"), ignore=shutil.ignore_patterns("__pycache__"))
        try:
            return subprocess.run([sys.executable, os.path.join(tmp, "tests", "test_full_time.py")], capture_output=True, text=True, timeout=20).returncode
        except subprocess.TimeoutExpired:
            return 99
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def main():
    assert run(SRC) == 0, "the unmodified contract must pass the tests first"
    killed, survived, skipped = [], [], []
    for name, old, new in MUTANTS:
        if name in EQUIVALENT: skipped.append((name, "equivalent: " + EQUIVALENT[name])); continue
        if source.count(old) != 1: skipped.append((name, "pattern found %d times" % source.count(old))); continue
        tmp = tempfile.mkdtemp(); m = os.path.join(tmp, "m.py"); open(m, "w").write(source.replace(old, new, 1))
        if subprocess.run([sys.executable, "-m", "py_compile", m], capture_output=True).returncode != 0: skipped.append((name, "does not compile"))
        elif run(m) != 0: killed.append(name)
        else: survived.append(name)
        shutil.rmtree(tmp, ignore_errors=True)
    print("mutants killed: %d of %d" % (len(killed), len(killed) + len(survived)))
    for n in survived: print("  SURVIVED:", n)
    for n, why in skipped: print("  not counted (%s): %s" % (why, n))
    return 0 if not survived else 1

if __name__ == "__main__":
    sys.exit(main())
