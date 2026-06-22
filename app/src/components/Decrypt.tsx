import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEF0123456789xZ§∆<>/\\[]{}=+*^?#";

// Reveals text as if it were being decrypted: each character resolves left to
// right out of cycling ciphertext. Respects prefers-reduced-motion.
export function Decrypt({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const [out, setOut] = useState(text);
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(text);
      return;
    }
    const dur = 650 + text.length * 26;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t + delay;
      const p = Math.min(1, Math.max(0, (t - start) / dur));
      const reveal = p * text.length;
      let s = "";
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") s += " ";
        else if (i < reveal - 0.4) s += text[i];
        else s += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      setOut(s);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [text, delay]);

  return <span className={className}>{out}</span>;
}
