export function ConfidentialPanel() {
  return (
    <div className="panel">
      <h3>Confidential amounts</h3>
      <p className="sub">
        Hide transfer amounts and balances with Token-2022 confidential transfers,
        while keeping a mint-level auditor key for compliance. The transaction graph
        stays public — only the numbers are shielded.
      </p>
      <span className="status gated">localnet only — proof program disabled on mainnet</span>

      <div className="readout" style={{ marginTop: 18 }}>
        <div><span className="k">flow </span>public balance
          <span className="k"> → </span>confidential pending
          <span className="k"> → </span>available
          <span className="k"> → </span><span className="shielded">confidential transfer</span></div>
        <div style={{ marginTop: 8 }}><span className="k">auditor </span><span className="ok">ElGamal key set at mint level</span></div>
      </div>

      <p className="hint">
        Run a local validator cloning the mainnet Token Extension program, then use
        confidential.createConfidentialMint(...) with an auditor ElGamal key. The
        transfer/withdraw steps are proof-gated until Solana re-enables the ZK
        ElGamal Proof program.
      </p>
    </div>
  );
}
