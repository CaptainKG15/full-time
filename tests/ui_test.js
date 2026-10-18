// Browser checks for the Full Time demo page. Needs playwright and a local web server on port 8125 serving this folder:
//   python3 -m http.server 8125   (from the project root), then   node tests/ui_test.js
// It runs the page against a simulated chain that follows the contract's rules, and a pretend wallet. It does not use a real network.
const { chromium } = require("playwright");
const STUB = `
const S = globalThis.__ft = globalThis.__ft || { matches: [], owner: null, edited: false, failBefore: 0, notFound: 0, deployed: false };
const G = (team, player, minute) => ({ team, player, minute });
const FIN = (hg, ag, goals) => ({ ok: true, status: "finished", hg, ag, goals });
function extract(m) {
  if (/05_harbor/.test(m.url)) return { ok: false, why: "refused" };
  if (/01_harbor/.test(m.url) && m.home !== "Harbor City") return { ok: false, why: "wrong_page" };
  if (/01_harbor/.test(m.url)) return FIN(3, 1, [G("home", "Valenti", 12), G("away", "Okonkwo", 34), G("home", "Mensah", 58), G("home", "Valenti", 77)]);
  if (/02_westfield/.test(m.url)) return { ok: true, status: "not_finished", hg: 0, ag: 0, goals: [] };
  if (/03_eastbank/.test(m.url)) return { ok: true, status: "abandoned", hg: 0, ag: 0, goals: [] };
  if (/04_marlow/.test(m.url)) return { ok: false, why: "invalid" };
  if (/07_riverbank/.test(m.url)) return S.edited ? FIN(2, 2, [G("home", "Hart", 20), G("away", "Cole", 55), G("home", "Hart", 88), G("away", "Cole", 90)]) : FIN(2, 1, [G("home", "Hart", 20), G("away", "Cole", 55), G("home", "Hart", 88)]);
  return { ok: false, why: "unreadable" };
}
const same = (a, b) => a.status === b.status && a.hg === b.hg && a.ag === b.ag && a.goals.length === b.goals.length;
const map = (o) => new Map(Object.entries(o));
const view = (m) => map({ id: m.id, url: m.url, home: m.home, away: m.away, state: m.state, last: m.last, first: m.first, second: m.second, reads: BigInt(m.reads), disputes: BigInt(m.disputes) });
const meOf = (o) => !o || !o.account ? null : (typeof o.account === "string" ? o.account : o.account.address);
export function generatePrivateKey() { return "0x" + [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join(""); }
export function createAccount(pk) { return { address: "0x" + pk.slice(2, 42) }; }
export function createClient(o) { const me = meOf(o); return {
  connect: async () => {}, initializeConsensusSmartContract: async () => {},
  deployContract: async () => { S.deployed = true; return "0x" + "8".repeat(64); }, waitForTransactionReceipt: async () => ({ data: { contract_address: "0x" + "f".repeat(40) } }),
  readContract: async ({ functionName: f, args }) => { if (S.notFound > 0) { S.notFound--; throw new Error("Requested resource not found."); } if (f === "count") return BigInt(S.matches.length); const m = S.matches[Number(args[0])]; if (!m) throw new Error("unknown match"); return view(m); },
  writeContract: async ({ functionName: f, args }) => {
    if (S.failBefore > 0) { S.failBefore--; throw new Error("An unknown RPC error occurred."); }
    if (f === "open_match") S.matches.push({ id: S.matches.length, url: args[0], home: args[1], away: args[2], state: "open", last: "", first: null, second: null, reads: 0, disputes: 0 });
    else if (f === "read") { const m = S.matches[Number(args[0])]; if (!["open", "disputed"].includes(m.state)) throw new Error("[EXPECTED] already has a reading"); const r = extract(m); m.reads++; m.last = r.ok ? r.status : r.why; if (r.ok && r.status === "finished") { m.first = r; m.second = null; m.state = "provisional"; } }
    else if (f === "confirm") { const m = S.matches[Number(args[0])]; if (m.state !== "provisional") throw new Error("[EXPECTED] only a provisional result can be confirmed"); const r = extract(m); m.reads++; m.last = r.ok ? r.status : r.why; if (r.ok) { if (r.status === "finished" && same(m.first, r)) { m.second = r; m.state = "final"; } else { m.second = r; m.state = "disputed"; m.disputes++; } } }
    return "0x" + "7".repeat(64); } }; }
export const studionet = {}; export const testnetBradbury = {}; export const TransactionStatus = { ACCEPTED: "ACCEPTED" };`;
const WALLET = "0xa82b922E107b75f374D36946Cd446613bF38f522";
async function open(b, { wallet = false, w = 1280, h = 900, balance = "0x4ec1a3c4f2f6a6f5e" } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { window.__fastSleep = true; });
  if (wallet) await ctx.addInitScript((addr) => { const L = {}; window.__calls = []; window.__chain = "0x107d"; window.ethereum = { request: async ({ method, params }) => { window.__calls.push(method); if (method === "eth_requestAccounts") return [addr]; if (method === "eth_chainId") return window.__chain; if (method === "wallet_switchEthereumChain") { window.__chain = params[0].chainId; return null; } return null; }, on: (e, cb) => { (L[e] = L[e] || []).push(cb); } }; window.__emit = (e, p) => (L[e] || []).forEach((cb) => cb(p)); }, WALLET);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.route(/esm\.sh\/genlayer-js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: STUB }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.route("https://rpc-bradbury.genlayer.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: balance }) }));
  return p;
}
let bad = 0; const ok = (n, c, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (x ? "  -> " + x : "")); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(); const url = "http://localhost:8125/app/index.html"; const txt = async (p, s) => ((await p.textContent(s)) || "").replace(/\s+/g, " ").trim();
  const studio = async () => { const p = await open(b); await p.goto(url + "?network=studionet"); await p.waitForTimeout(700); return p; };
  const deploy = async (p) => { await p.click("#bDeploy"); await p.waitForTimeout(500); };
  const pick = async (p, name) => { await p.locator("#presets button", { hasText: name }).click(); };
  // Studio: a finished match becomes final after a second read
  let p = await studio(); ok("Studio connects a test key by itself", (await txt(p, "#chipNet")) === "Studio test key"); ok("the examples load as buttons", (await p.locator("#presets button").count()) === 6);
  await p.click("#bRun"); await p.waitForTimeout(500); ok("running before a registry exists says what to do", (await txt(p, "#alertTitle")).includes("Set up the registry first"), await txt(p, "#alertTitle"));
  await deploy(p); ok("deploying fills in the registry address", /^0x[0-9a-f]{40}$/i.test(await p.inputValue("#addr")));
  await p.click("#bRun"); await p.waitForTimeout(1500);
  ok("a finished match becomes FINAL after two reads", (await txt(p, "#bPill")) === "FINAL" && (await txt(p, "#bScore")) === "3 : 1", await txt(p, "#bPill") + " " + await txt(p, "#bScore"));
  ok("the scoreboard lists the scorers", (await p.locator("#bGoals li").count()) === 4 && (await txt(p, "#bGoals")).includes("Valenti"));
  ok("all three progress lines finished", (await p.locator("#runProg li.done").count()) === 3);
  ok("the match is listed with its state", (await p.locator(".mcard.final").count()) === 1);
  // other kinds of report
  await pick(p, "still being played"); await p.click("#bRun"); await p.waitForTimeout(1200);
  ok("a live match stays OPEN and says why", (await txt(p, "#bPill")) === "OPEN" && (await txt(p, "#bMeta")).includes("still being played") && (await p.locator("#runProg li.skip").count()) === 1, await txt(p, "#bMeta"));
  await pick(p, "postponed"); await p.click("#bRun"); await p.waitForTimeout(1200); ok("a postponed match stays OPEN and says why", (await txt(p, "#bMeta")).includes("postponed"));
  await pick(p, "give orders"); await p.click("#bRun"); await p.waitForTimeout(1200); ok("a report that gives orders is refused and says why", (await txt(p, "#bMeta")).includes("give orders"));
  await pick(p, "different teams"); await p.click("#bRun"); await p.waitForTimeout(1200); ok("a report for different teams is recognised", (await txt(p, "#bMeta")).includes("different teams"));
  await pick(p, "contradicts"); await p.click("#bRun"); await p.waitForTimeout(1200); ok("a self-contradicting report is marked as not adding up", (await txt(p, "#bMeta")).includes("did not add up"));
  ok("no page errors (Studio)", p.errs.length === 0, p.errs.join("; "));
  // the dispute demonstration
  p = await studio(); await deploy(p); await p.evaluate(() => { document.getElementById("disputeWrap").open = true; }); await p.click("#bEdit"); await p.click("#bRun"); await p.waitForTimeout(1200);
  ok("the editable report stops at PROVISIONAL so the report can be changed", (await txt(p, "#bPill")) === "PROVISIONAL" && (await txt(p, "#bScore")) === "2 : 1" && (await p.locator("#runProg li.skip").count()) === 1);
  await p.evaluate(() => { globalThis.__ft.edited = true; }); await p.locator(".mcard button", { hasText: "Confirm" }).click(); await p.waitForTimeout(1200);
  ok("a report that changed between the reads makes the match DISPUTED", (await txt(p, "#bPill")) === "DISPUTED" && (await txt(p, "#bMeta")).includes("2 : 2"), await txt(p, "#bMeta"));
  await p.locator(".mcard button", { hasText: "Read again" }).click(); await p.waitForTimeout(1200); ok("a disputed match can be read again and goes back to PROVISIONAL", (await txt(p, "#bPill")) === "PROVISIONAL" && (await txt(p, "#bScore")) === "2 : 2");
  // run all examples
  p = await studio(); await deploy(p); await p.evaluate(() => { document.getElementById("exWrap").open = true; }); await p.click("#bEx"); await p.waitForTimeout(5000);
  const verdicts = await p.locator("#exBody tr td:last-child").allTextContents(); ok("all six examples run and match what the design predicts", verdicts.length === 6 && verdicts.every((v) => v === "yes"), verdicts.join(","));
  ok("the results text is ready to copy", (await p.inputValue("#exOut")).includes("6 of 6 run"));
  // flaky network
  p = await studio(); await deploy(p); await p.evaluate(() => { globalThis.__ft.failBefore = 3; }); await p.click("#bRun"); await p.waitForTimeout(2500);
  ok("three network errors in a row are retried and the match still becomes FINAL", (await txt(p, "#bPill")) === "FINAL" && (await txt(p, "#log")).includes("hiccuped"));
  p = await studio(); await p.evaluate(() => { globalThis.__ft.notFound = 2; }); await p.click("#bDeploy"); await p.waitForTimeout(1500);
  ok("a brand-new contract that cannot be read yet is retried with no error shown", !(await txt(p, "#log")).includes("ERROR"));
  // Bradbury with a wallet
  p = await open(b, { wallet: true }); await p.goto(url); await p.waitForTimeout(700);
  ok("Bradbury is the default and shows a Connect wallet button", (await txt(p, "[data-net].on")) === "Bradbury" && (await p.isVisible("#bConnectTop")));
  await p.click("#bConnect"); await p.waitForTimeout(600);
  ok("connecting shows the address, the network and the balance", (await txt(p, "#chipAddr")) === "0xa82b...f522" && (await txt(p, "#chipNet")) === "Bradbury" && /GEN/.test(await txt(p, "#chipBal")), await txt(p, "#chip"));
  await deploy(p); await p.click("#bRun"); await p.waitForTimeout(1500); ok("a wallet user gets a FINAL result", (await txt(p, "#bPill")) === "FINAL");
  await p.evaluate(() => { window.__chain = "0x1"; window.__emit("chainChanged", "0x1"); }); await p.waitForTimeout(500); ok("a wrong network is explained, with a fix", (await txt(p, "#alertTitle")).includes("different network"));
  p = await open(b); await p.goto(url); await p.waitForTimeout(500); await p.click("#bConnect"); await p.waitForTimeout(300); ok("with no wallet installed the page explains what to do", (await txt(p, "#alertTitle")).includes("No wallet found"));
  p = await open(b, { wallet: true }); await p.goto(url); await p.waitForTimeout(500); await p.click("#bDeploy"); await p.waitForTimeout(400); ok("deploying before connecting says to connect first", (await txt(p, "#alertTitle")).includes("Connect your wallet first"));
  // phone
  const m = await open(b, { wallet: true, w: 390, h: 844 }); await m.goto(url); await m.waitForTimeout(700); await m.click("#bConnect"); await m.waitForTimeout(500); ok("phone: no sideways scrolling", await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await m.screenshot({ path: "/tmp/shots/ft_mobile.png", fullPage: true });
  p = await studio(); await deploy(p); await p.click("#bRun"); await p.waitForTimeout(1500); await p.screenshot({ path: "/tmp/shots/ft_final.png", fullPage: true });
  console.log(bad ? "\n" + bad + " FAILED" : "\nall checks passed"); await b.close(); process.exit(bad ? 1 : 0);
})();
