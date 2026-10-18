# Results

Only what was observed is listed. Open items are marked open.

## Off-chain (contract SHA-256 starting `71d2aa20c90dc67c`, 8,129 bytes)
- 122 checks pass. 61 of 61 countable mutants killed, with three equivalents documented.
- 9 fixture checks: the demo reports that should be stopped by plain code are, and the others reach the model.
- 29 browser checks of the demo page against a simulated chain and a pretend wallet.
- The test suite found one real flaw while it was being written: a refusal pattern that matched a plain "Status:" line would have rejected honest match reports. It was tightened to match only a quoted key or a direct "record the score as" order, and tests now cover honest pages that say "Status: FT".
- The mutation test found that two checks cannot be the only one to fail (they duplicate another rule), and the script lists them as equivalent with the reason.

## Studio: all six examples run with real validators (all matched the design)
Registry `0x31e24aEBd94E02A2B603eB01284471eD39988EdC`, deployed from the page (8,129 bytes, SHA-256 starting `71d2aa20c90dc67c`). Each example was opened and read once; the finished match was also confirmed. Times are the page's clock.

| # | Example | The design predicts | What happened |
|---|---------|---------------------|---------------|
| 1 | A finished match (Harbor City v Northgate Rovers) | provisional, then final | **final** (last read: finished) |
| 2 | A match still being played | stays open, last read: not_finished | open (last read: not_finished) |
| 3 | A postponed match | stays open, last read: abandoned | open (last read: abandoned) |
| 4 | A report that contradicts itself | stays open, last read: invalid | open (last read: invalid) |
| 5 | A report that tries to give orders | stays open, last read: refused | open (last read: refused) |
| 6 | A report for different teams | stays open, last read: wrong_page | open (last read: wrong_page) |

Timing: the first read of the finished match was accepted at 10:11:40 (about 16 seconds after it was sent) and the second, separate read at 10:12:00 (about 16 seconds); it was final at 10:12:02. All 13 transactions took about three and a half minutes (10:11:14 to 10:14:31).

What this shows and does not show:
- **The model was used for examples 1 to 4.** It correctly told a finished match from one still being played and from a postponed one, and the finished match was read the same way twice, so it became final.
- **Examples 5 and 6 never reached the model.** Plain code refused the report that gave orders and the report about other teams. They test the contract's rules, not the model.
- **Example 4 was labelled exploratory before the run**, because the model might have quietly resolved the contradiction instead of reporting it. It did not. The log cannot tell whether its reading failed to add up or failed to parse; both are recorded as `invalid` and change nothing.
- One read hit a transient network error and was retried automatically.
- The "design predicts" column is my own prediction made before the run, so a match is evidence the design works as intended, not independent proof. It is **one run of one report each**: it says nothing about how often validators disagree, or about real match reports.

## A real dispute: open
The page explains how to change a report between the two reads so the second read sees a different result. This has been shown only against a simulated chain. It has not been done on a real network.

## Bradbury: a finished match confirmed to final (worked)
Registry `0x91E80fFfc5F912A46423ad56bEd6596231D44f59`, deployed from the page with a browser wallet (8,129 bytes, SHA-256 starting `71d2aa20c90dc67c`). Only the finished-match example was run here. Times are the page's clock.

| Time | Event |
|---|---|
| 10:25:35 | wallet connected |
| 10:26:00 | registry deployed (about 25 seconds later) |
| 10:26:39 | match opened (Harbor City v Northgate Rovers) |
| 10:27:24 | first read accepted, about 43 seconds after it was sent; the match was provisional |
| 10:27:50 | second, separate read accepted, about 24 seconds after it was sent |

Result: **FINAL**, Harbor City 3 : 1 Northgate Rovers, two reads, last read "finished". From opening the match to final took about a minute and a half.

What this shows and does not show: the whole flow works on Bradbury with real validators and a real wallet, and the finished match was read the same way twice. It is **one match**. The other five examples and the real-network dispute were not run on Bradbury.
