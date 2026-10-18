# Full Time

**A match-result registry in which a result only becomes final after two separate reads agree.**

Match results come from web pages, and pages are wrong early: live scores, typos, late corrections. Anything built on a result (a fantasy league, a prediction market, a bounty) needs to know whether the result has settled. Full Time makes that a property of the contract. Validators read a report page and extract structured facts: the status, the score and who scored when. A first agreed reading is only **provisional**. A second, separate read must agree with it before the match becomes **final**. If the page changed in between, the match becomes **disputed** and nothing is finalised.

Testnet only. Every club, player and score in the demo is invented.

## How it works
1. `open_match(url, home, away)`: anyone opens a match with an https report address and two team names.
2. `read(match id)`: validators read the page and agree on a reading. A finished match becomes **provisional**. A match still being played, or postponed, stays **open** and the contract records why.
3. `confirm(match id)`: a separate read. If it agrees with the first, the match is **final**. If it disagrees, or says the match is not finished, the match is **disputed**. If the page cannot be read or makes no sense, nothing changes, because failing to read is not the same as disagreeing.
4. A disputed match can be read again to start over. A final match never changes.

| State | Meaning |
|---|---|
| `open` | no finished reading yet |
| `provisional` | one finished reading, not yet confirmed |
| `final` | two separate readings agreed |
| `disputed` | the second reading disagreed |

## How consensus is used
Two questions need judgement that code cannot supply: what does this report say, and do two readings agree?
- **What the validators decide.** The leader and each validator independently read the page and answer one prompt, returning typed facts: `status` (`finished`, `not_finished` or `abandoned`), the two scores, and a list of goals with team, scorer and minute.
- **Plain code first.** Before the model is asked, code refuses a page that contains instruction-like text, and refuses a page that does not mention both team names. After the model answers, code checks the reading adds up: the number of goals equals the score, each team's goals equal its score, every minute is between 1 and 130, no score is above 20, and a match that is not finished lists no goals. A reading that fails these checks is recorded as `invalid` and changes nothing.
- **The custom equivalence check** (`same_reading`) is typed, not textual. Status and both scores must match **exactly**. Scorers are matched one to one by **team and surname**, with minutes allowed to differ by **at most one**. So "Marco Valenti 12'" and "M. Valenti 13'" agree, and a different scorer, a different team or a minute two out do not.
- **The same check is used twice:** between the leader and the validators within one read, and between the stored first reading and the confirming reading. The second use is what turns two reads into finality.
- **Failures are safe.** A validator that disagrees blocks the read and nothing is stored. A page that is unreadable, invalid, refused or about other teams never causes a dispute. Only a successful reading that disagrees does.

## State design
`matches` (url, teams, state, last result, the first and second readings as stored JSON, read and dispute counts) and a counter. One contract is a registry of many matches.

## Testing
- `python3 tests/test_full_time.py`: 122 off-chain checks. A stand-in network replaces the real one, so they test the contract's logic, not the model.
- `python3 tests/mutation_test.py`: breaks the contract in 62 small ways and confirms the tests fail each time. **61 of 61 countable mutants killed.** Three more are genuine equivalents (checks that duplicate another rule), listed in the script with the reason for each.
- `python3 tests/test_fixtures.py`: checks every demo report against the contract's own rules (9 checks).
- `tests/ui_test.js`: 29 browser checks of the demo page against a simulated chain and a pretend wallet, including a report that changes between the two reads. It does not use a real network.
- The pre-check patterns were tightened after a test showed they would have refused honest pages that say "Status: Full time".

## Honest limits
- **Final means two reads agreed, not that the result is true.** A page that is consistently wrong gives a consistently wrong final result. The contract reads one report per match.
- **The second read is separate in time, not guaranteed independent.** The same validators may fetch the same page, and a cached copy can hide a recent change. A change shows up only if the page really differs when it is read again.
- **Surname matching can merge two scorers who share a surname** in the same minute. A model can also misread a report; how well it reads real reports is only tested on the invented pages here.
- A report with a contradiction (a headline score that does not match the goals listed) might be resolved by the model instead of reported as invalid. The demo records what happens.
- One match per report address; no rescheduling, no extra time and penalty-shootout rules; goals only. The registry is open to anyone.

## Run it
Host the folder on GitHub Pages and open `app/index.html`.
- **Studio (no wallet):** press **Deploy my registry**, pick a report, press **Run it**. Or open "Run all the examples" to run every report and compare each with what the design predicts.
- **Bradbury:** press **Connect wallet**, then the same steps. Each transaction needs a wallet approval.
- **A dispute, for real:** the page explains how to change the editable report between the two reads.
`build_app.py` rebuilds the page with the contract embedded. `matches/generate.py` regenerates the invented reports.

## Files
- `contracts/full_time.py`: the contract, 8,129 bytes, SHA-256 `71d2aa20c90dc67ca8a6028d5bbf788f08966ddbccd3d0087b5f919f1867a6c9`
- `matches/`: the invented match reports and the manifest
- `tests/`: the tests and the mutation test
- `app/`: the demo page
