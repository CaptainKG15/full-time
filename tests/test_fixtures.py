# Checks every invented match report against the contract's own deterministic rules (no network, no model).
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "stub")); sys.path.insert(0, os.path.join(HERE, "..", "contracts"))
import full_time as T
M = os.path.join(HERE, "..", "matches"); man = json.load(open(os.path.join(M, "manifest.json"))); n = 0
def check(name, cond):
    global n; assert cond, "FAILED: " + name; n += 1; print("PASS", name)
for c in man["cases"]:
    text = T.html_to_text(open(os.path.join(M, c["file"])).read()); pre = T.pre_check(text, c["home"], c["away"])
    want = c["expect"].get("last")
    if want in ("refused", "wrong_page"): check("case %d (%s) is stopped by plain code as %s" % (c["id"], c["name"], want), pre == want)
    else: check("case %d (%s) reaches the model, so the model really is tested" % (c["id"], c["name"]), pre is None and len(text) > 60)
e = man["editable"]
for k in ("file", "corrected"):
    text = T.html_to_text(open(os.path.join(M, e[k])).read()); check("the editable report (%s) reaches the model" % k, T.pre_check(text, e["home"], e["away"]) is None)
a, b = T.html_to_text(open(os.path.join(M, e["file"])).read()), T.html_to_text(open(os.path.join(M, e["corrected"])).read())
check("the corrected version really differs from the original", a != b and "2-1" in a and "2-2" in b)
print("\n%d fixture checks passed" % n)
