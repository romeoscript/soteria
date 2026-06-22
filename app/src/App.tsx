import { useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LiveGraph } from "./components/LiveGraph";
import { Decrypt } from "./components/Decrypt";
import { StealthPanel } from "./components/StealthPanel";
import { CredentialPanel } from "./components/CredentialPanel";
import { ConfidentialPanel } from "./components/ConfidentialPanel";

const TABS = [
  { id: "credential", name: "Selective disclosure", sub: "prove membership, hide identity" },
  { id: "stealth", name: "Stealth receiving", sub: "one-time receive addresses" },
  { id: "confidential", name: "Confidential amounts", sub: "shielded balances" },
] as const;

const PANELS = {
  credential: CredentialPanel,
  stealth: StealthPanel,
  confidential: ConfidentialPanel,
};

function Sigil() {
  return (
    <svg className="sigil" viewBox="0 0 40 40" fill="none">
      <path d="M20 3 6 9v9c0 8 6 13 14 16 8-3 14-8 14-16V9L20 3Z" stroke="#34e7cf" strokeWidth="1.4" opacity="0.45" />
      <circle cx="14" cy="17" r="2.3" fill="#34e7cf" />
      <circle cx="26" cy="23" r="2.3" fill="#b07cff" />
      <line x1="14" y1="17" x2="26" y2="23" stroke="#34e7cf" strokeWidth="1.2" opacity="0.7" />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("credential");
  const Panel = PANELS[tab];

  return (
    <MotionConfig reducedMotion="user">
      <div className="aurora" />
      <div className="grid" />
      <div className="grain" />

      <div className="wrap">
        <header className="bar">
          <div className="brand">
            <Sigil />
            <div>
              <h1>SOTERIA</h1>
              <div className="tag">privacy toolkit</div>
            </div>
          </div>
          <div className="bar-right">
            <span className="tag pill">devnet</span>
            <WalletMultiButton />
          </div>
        </header>

        <section className="hero">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="eyebrow">Solana · no mixer · auditor-native</div>
            <h2>
              Hide the <span className="cipher grad"><Decrypt text="payload" delay={260} /></span>.
              <br />
              Keep the <span className="grad">graph honest</span>.
            </h2>
            <p>
              Three privacy primitives that protect users without pooling funds or
              severing who-paid-whom. Every shield keeps a disclosure path.
            </p>
            <div className="creed">
              <span>no mixer</span>
              <span>no link-severing</span>
              <span>auditor-key native</span>
              <span>groth16 · alt_bn128</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
          >
            <LiveGraph />
          </motion.div>
        </section>

        <section className="rail">
          <div className="rail-head">
            <h3>The primitives</h3>
            <span className="count">03 / modules</span>
          </div>

          <div className="tabs">
            {TABS.map((t, i) => (
              <motion.button
                key={t.id}
                className="tab"
                data-active={tab === t.id}
                onClick={() => setTab(t.id)}
                whileTap={{ scale: 0.98 }}
              >
                <span className="glow" />
                <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                <span className="t-name">{t.name}</span>
                <span className="t-sub">{t.sub}</span>
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
            >
              <Panel />
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </MotionConfig>
  );
}
