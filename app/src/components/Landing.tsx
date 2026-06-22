import { motion, type Variants } from "framer-motion";
import { LiveGraph } from "./LiveGraph";
import { AuroraText } from "./ui/aurora-text";
import { Meteors } from "./ui/meteors";
import { Marquee } from "./ui/marquee";
import { Spotlight } from "./ui/spotlight";

const CREDS = [
  "groth16", "alt_bn128", "poseidon merkle", "scoped nullifier", "token-2022",
  "ed25519 stealth", "ElGamal auditor", "no mixer", "no link-severing",
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <section className="hero-full">
      <div className="hero-bg">
        <Spotlight className="spot-1" fill="#5bd1ff" />
        <Spotlight className="spot-2" fill="#b07cff" />
        <motion.div
          className="hero-graph"
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        >
          <LiveGraph />
        </motion.div>
        <div className="meteor-field">
          <Meteors number={16} angle={235} />
        </div>
        <div className="hero-scrim" />
      </div>

      <motion.div className="hero-center" variants={container} initial="hidden" animate="show">
        <motion.div className="eyebrow centered" variants={item}>
          Solana · no mixer · auditor-native
        </motion.div>
        <motion.h1 variants={item}>
          Hide the <AuroraText className="cipher" colors={["#b07cff", "#ff5db1", "#b07cff"]}>payload</AuroraText>.
          <br />
          Keep the <AuroraText colors={["#34e7cf", "#5bd1ff", "#34e7cf"]}>graph honest</AuroraText>.
        </motion.h1>
        <motion.p variants={item}>
          Three privacy primitives that protect users without pooling funds or
          severing who-paid-whom. Every shield keeps a disclosure path.
        </motion.p>
        <motion.div className="cta-row centered" variants={item}>
          <button className="act" onClick={onEnter}>Enter the toolkit →</button>
          <a className="act ghost" href="https://github.com/romeoscript/soteria" target="_blank" rel="noreferrer">
            View source
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        className="hero-marquee"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
      >
        <Marquee className="creds" pauseOnHover>
          {CREDS.map((c) => (
            <span className="cred-chip" key={c}>
              <span className="dot" />{c}
            </span>
          ))}
        </Marquee>
      </motion.div>
    </section>
  );
}
