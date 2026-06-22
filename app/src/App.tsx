import { useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Landing } from "./components/Landing";
import { Workspace } from "./components/Workspace";

type View = "landing" | "app";
type Module = "credential" | "stealth" | "confidential";

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
  const [view, setView] = useState<View>(
    () => (typeof location !== "undefined" && location.hash === "#app" ? "app" : "landing")
  );
  const [tab, setTab] = useState<Module>("credential");

  return (
    <MotionConfig reducedMotion="user">
      <div className="aurora" />
      <div className="grid" />
      <div className="grain" />

      <div className="wrap">
        <header className="bar">
          <button className="brand" onClick={() => setView("landing")} aria-label="Home">
            <Sigil />
            <div>
              <h1>SOTERIA</h1>
              <div className="tag">privacy toolkit</div>
            </div>
          </button>
          <nav className="bar-right">
            {view === "app" && (
              <button className="nav-link" onClick={() => setView("landing")}>← home</button>
            )}
            <span className="tag pill">devnet</span>
            <WalletMultiButton />
          </nav>
        </header>

        <AnimatePresence mode="wait">
          {view === "landing" ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              <Landing onEnter={() => setView("app")} />
            </motion.div>
          ) : (
            <motion.div
              key="app"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Workspace tab={tab} setTab={setTab} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
