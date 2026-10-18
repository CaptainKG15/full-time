# Results

Only what was observed is listed. Open items are marked open.

## Off-chain (contract SHA-256 starting `71d2aa20c90dc67c`, 8,129 bytes)
- 122 checks pass. 61 of 61 countable mutants killed, with three equivalents documented.
- 9 fixture checks: the demo reports that should be stopped by plain code are, and the others reach the model.
- 29 browser checks of the demo page against a simulated chain and a pretend wallet.
- The test suite found one real flaw while it was being written: a refusal pattern that matched a plain "Status:" line would have rejected honest match reports. It was tightened to match only a quoted key or a direct "record the score as" order, and tests now cover honest pages that say "Status: FT".
- The mutation test found that two checks cannot be the only one to fail (they duplicate another rule), and the script lists them as equivalent with the reason.

## On a real network: open
Not run yet when this was written. This section will record real runs on Studio and on Bradbury, with failures included: what the validators read from each invented report, whether they reached consensus, whether a second read confirmed the finished match, and whether a changed report was caught as a dispute.
