-- Hidden-amount shielded pool (Option B) operator persistence.
CREATE TABLE IF NOT EXISTS shielded_records (
  id serial PRIMARY KEY,
  shielded_id integer NOT NULL,
  leaf_index integer NOT NULL,
  commitment text NOT NULL,
  encrypted_secret text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shielded_records_pool_leaf_idx
  ON shielded_records (shielded_id, leaf_index);
CREATE INDEX IF NOT EXISTS shielded_records_pool_idx
  ON shielded_records (shielded_id);

CREATE TABLE IF NOT EXISTS shielded_nullifiers (
  shielded_id integer NOT NULL,
  nullifier_key text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (shielded_id, nullifier_key)
);
