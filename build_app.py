# Builds app/index.html from app/index.src.html by embedding contracts/full_time.py (so the page can deploy it).
import json, os
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, "contracts", "full_time.py")).read()
tpl = open(os.path.join(here, "app", "index.src.html")).read()
assert tpl.count("__CONTRACT_SOURCE__") == 1
open(os.path.join(here, "app", "index.html"), "w").write(tpl.replace("__CONTRACT_SOURCE__", json.dumps(src)))
print("built app/index.html with", len(src), "characters of contract source embedded")
