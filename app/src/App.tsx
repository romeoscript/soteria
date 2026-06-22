import { useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LiveGraph } from "./components/LiveGraph";
import { AuroraText } from "./components/ui/aurora-text";
import { Meteors } from "./components/ui/meteors";
import { BorderBeam } from "./components/ui/border-beam";
import { Marquee } from "./components/ui/marquee";
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

const CREDS = [
  "groth16", "alt_bn128", "poseidon merkle", "scoped nullifier", "token-2022",
  "ed25519 stealth", "ElGamal auditor", "no mixer", "no link-severing",
];

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

        <section className="hero-shell">
          <div className="meteor-field">
            <Meteors number={26} angle={235} />
          </div>
          <div className="hero">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <div className="eyebrow">Solana · no mixer · auditor-native</div>
              <h2>
                Hide the <AuroraText className="cipher" colors={["#b07cff", "#ff5db1", "#b07cff"]}>payload</AuroraText>.
                <br />
                Keep the <AuroraText colors={["#34e7cf", "#5bd1ff", "#34e7cf"]}>graph honest</AuroraText>.
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
          </div>
        </section>

        <Marquee className="creds" pauseOnHover>
          {CREDS.map((c) => (
            <span className="cred-chip" key={c}>
              <span className="dot" />{c}
            </span>
          ))}
        </Marquee>

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
                {tab === t.id && <BorderBeam size={70} duration={5} borderWidth={1.4} />}
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              className="panel-shell"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
            >
              <Panel />
              <BorderBeam size={160} duration={9} borderWidth={1.4} delay={1.5} />
            </motion.div>
          </AnimatePresence>
        </section>

        <footer className="foot">
          <span>SOTERIA</span>
          <span>privacy that keeps the graph honest</span>
        </footer>
      </div>
    </MotionConfig>
  );
}
