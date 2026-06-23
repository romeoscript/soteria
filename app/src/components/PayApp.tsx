import { useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { QRCodeSVG } from "qrcode.react";
import {
  DERIVE_MESSAGE,
  decodeMeta,
  payLink,
  sendPrivate,
  scanPayments,
  sweep,
  fmtSol,
  type StealthKeys,
  type DetectedPayment,
} from "../lib/stealthPay";
import { stealth, short } from "../lib/soteria";

type Mode = "receive" | "send";

const payParam = () =>
  typeof location !== "undefined" ? new URLSearchParams(location.search).get("pay") : null;

type FeedItem = {
  payment: DetectedPayment;
  status: "received" | "sweeping" | "swept" | "failed";
  sig?: string;
  error?: string;
};

export function PayApp() {
  const initialMode: Mode = payParam() ? "send" : "receive";
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <section className="pay">
      <div className="pay-head">
        <h2>Private payments</h2>
        <p className="sub">
          Share one link and get paid to fresh, unlinkable addresses every time. Your
          main wallet never appears on-chain. Powered by stealth addresses — no mixer,
          no custody.
        </p>
        <div className="seg">
          <button className={mode === "receive" ? "on" : ""} onClick={() => setMode("receive")}>
            Receive
          </button>
          <button className={mode === "send" ? "on" : ""} onClick={() => setMode("send")}>
            Send
          </button>
        </div>
      </div>
      {mode === "receive" ? <Receive /> : <Send />}
    </section>
  );
}

function Receive() {
  const { connection } = useConnection();
  const { publicKey, signMessage } = useWallet();
  const [keys, setKeys] = useState<StealthKeys | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoSweep, setAutoSweep] = useState(true);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [watching, setWatching] = useState(false);

  const autoSweepRef = useRef(autoSweep);
  autoSweepRef.current = autoSweep;
  const seen = useRef<Set<string>>(new Set());
  const inFlight = useRef<Set<string>>(new Set());

  const link = useMemo(() => (keys ? payLink(keys.meta) : ""), [keys]);

  async function createIdentity() {
    setError(null);
    if (!signMessage) {
      setError("Your wallet doesn't support message signing. Try Phantom, Solflare, or Backpack.");
      return;
    }
    try {
      setBusy("Sign in your wallet to derive your keys…");
      const signature = await signMessage(DERIVE_MESSAGE);
      setKeys(stealth.deriveStealthKeys(signature));
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not derive keys");
    } finally {
      setBusy(null);
    }
  }

  const patch = (address: string, p: Partial<FeedItem>) =>
    setFeed((f) => f.map((it) => (it.payment.address === address ? { ...it, ...p } : it)));

  async function sweepOne(payment: DetectedPayment) {
    if (!publicKey || inFlight.current.has(payment.address)) return;
    inFlight.current.add(payment.address);
    patch(payment.address, { status: "sweeping", error: undefined });
    try {
      const sig = await sweep({ connection, payment, destination: publicKey });
      patch(payment.address, { status: "swept", sig });
    } catch (e) {
      patch(payment.address, {
        status: "failed",
        error: e instanceof Error ? e.message : "sweep failed",
      });
    } finally {
      inFlight.current.delete(payment.address);
    }
  }

  // Live: watch the registry and sweep payments the moment they land.
  useEffect(() => {
    if (!keys || !publicKey) return;
    let alive = true;
    setWatching(true);
    const tick = async () => {
      let found;
      try {
        found = await scanPayments({ connection, keys });
      } catch {
        return; // transient RPC/registry blip — the next tick retries
      }
      if (!alive) return;
      for (const p of found) {
        if (seen.current.has(p.address)) continue;
        seen.current.add(p.address);
        setFeed((f) => [
          { payment: p, status: autoSweepRef.current ? "sweeping" : "received" },
          ...f,
        ]);
        if (autoSweepRef.current) sweepOne(p);
      }
    };
    tick();
    const id = setInterval(tick, 9000);
    return () => {
      alive = false;
      clearInterval(id);
      setWatching(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, publicKey, connection]);

  function enableAutoSweep(on: boolean) {
    setAutoSweep(on);
    if (on) feed.forEach((it) => it.status === "received" && sweepOne(it.payment));
  }

  if (!publicKey) {
    return (
      <div className="panel">
        <p className="sub">Connect a wallet to create your private payment link.</p>
        <div className="row"><WalletMultiButton /></div>
      </div>
    );
  }

  return (
    <div className="panel">
      {!keys ? (
        <>
          <h3>Your payment link</h3>
          <p className="sub">
            One signature derives your private receiving keys. They're recoverable from
            your wallet anytime — nothing is stored.
          </p>
          <div className="row">
            <button className="act" onClick={createIdentity} disabled={!!busy}>
              {busy ?? "Create my payment link"}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>Your payment link</h3>
          <div className="qr-wrap">
            <div className="qr"><QRCodeSVG value={link} size={148} bgColor="transparent" fgColor="#cdeee7" /></div>
            <div className="qr-side">
              <p className="sub">Share this link or QR. Anyone can pay you; only you can see and spend it.</p>
              <div className="linkbox">
                <code>{short(link, 18)}</code>
                <button
                  className="mini"
                  onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            </div>
          </div>

          <div className="watchbar" style={{ marginTop: 18 }}>
            <span className={`live ${watching ? "on" : ""}`}>
              <span className="pulse" />
              {watching ? "Watching for payments" : "Idle"}
            </span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={autoSweep}
                onChange={(e) => enableAutoSweep(e.target.checked)}
              />
              Auto-sweep to my wallet
            </label>
          </div>

          <div className="readout feed">
            {feed.length === 0 ? (
              <div><span className="k">incoming </span>nothing yet — share your link to get paid</div>
            ) : (
              feed.map((it) => (
                <div key={it.payment.address} className="payrow">
                  <span className="shielded">{fmtSol(it.payment.lamports)} SOL</span>
                  <span className="k"> · {short(it.payment.address)}</span>
                  <span className="pay-status">
                    {it.status === "received" && (
                      <button className="mini" onClick={() => sweepOne(it.payment)}>sweep</button>
                    )}
                    {it.status === "sweeping" && <span className="k">arriving…</span>}
                    {it.status === "swept" && (
                      <a
                        className="ok"
                        href={`https://explorer.solana.com/tx/${it.sig}?cluster=devnet`}
                        target="_blank" rel="noreferrer"
                      >arrived ↗</a>
                    )}
                    {it.status === "failed" && (
                      <button className="mini" onClick={() => sweepOne(it.payment)} title={it.error}>retry</button>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
      {error && <div className="readout" style={{ marginTop: 10 }}><span className="k">error </span>{error}</div>}
      <p className="hint">
        Each payment lands at a fresh one-time address only you can detect. With
        auto-sweep on, funds move to your wallet the moment they arrive — no action
        needed while this page is open. Turn it off to keep funds at their one-time
        addresses for stronger privacy and sweep on your own schedule.
      </p>
    </div>
  );
}

function Send() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [metaStr, setMetaStr] = useState(payParam() ?? "");
  const [sol, setSol] = useState("0.05");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ signature: string; stealthAddress: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setResult(null);
    if (!publicKey || !sendTransaction) { setError("connect a wallet to send"); return; }
    let meta;
    try { meta = decodeMeta(metaStr.trim()); } catch { setError("invalid payment link"); return; }
    const amount = parseFloat(sol);
    if (!Number.isFinite(amount) || amount <= 0) { setError("enter a valid amount"); return; }
    setBusy(true);
    try {
      const r = await sendPrivate({
        connection, sender: publicKey,
        sendTransaction: (tx, c) => sendTransaction(tx, c),
        meta, sol: amount,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "payment failed");
    } finally {
      setBusy(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="panel">
        <p className="sub">Connect a wallet to send a private payment.</p>
        <div className="row"><WalletMultiButton /></div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>Send a private payment</h3>
      <div className="row" style={{ marginTop: 14 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>recipient payment link</label>
          <input value={metaStr} onChange={(e) => setMetaStr(e.target.value)} placeholder="paste a soteria pay link or code" />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>amount (SOL)</label>
          <input value={sol} onChange={(e) => setSol(e.target.value)} inputMode="decimal" />
        </div>
      </div>
      <div className="row">
        <button className="act" onClick={pay} disabled={busy}>
          {busy ? "Sending privately…" : "Send privately"}
        </button>
      </div>

      {result && (
        <div className="readout ok" style={{ marginTop: 12 }}>
          <div><span className="k">sent to </span><span className="shielded">{short(result.stealthAddress)}</span> (one-time)</div>
          <div>
            <span className="k">tx </span>
            <a href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`} target="_blank" rel="noreferrer">
              {short(result.signature)} ↗
            </a>
          </div>
        </div>
      )}
      {error && <div className="readout" style={{ marginTop: 10 }}><span className="k">error </span>{error}</div>}
      <p className="hint">
        Your wallet pays a fresh one-time address derived from the recipient's link —
        their main wallet never appears in this transaction. The recipient detects and
        sweeps it with their private view key.
      </p>
    </div>
  );
}
