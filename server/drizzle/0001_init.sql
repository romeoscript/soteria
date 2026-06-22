CREATE TABLE IF NOT EXISTS announcements (
  id            serial PRIMARY KEY,
  ephemeral_pub text NOT NULL,
  view_tag      integer NOT NULL,
  stealth_pub   text,
  slot          bigint,
  signature     text,
  created_at    timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_slot_idx ON announcements (slot);

CREATE TABLE IF NOT EXISTS sets (
  id           text PRIMARY KEY,
  group_id     bigint,
  root         text,
  member_count integer NOT NULL DEFAULT 0,
  created_at   timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id          serial PRIMARY KEY,
  set_id      text NOT NULL REFERENCES sets (id),
  leaf_index  integer NOT NULL,
  commitment  text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS members_set_commitment_idx ON members (set_id, commitment);
CREATE INDEX IF NOT EXISTS members_set_idx ON members (set_id);

CREATE TABLE IF NOT EXISTS nullifiers (
  hash       text PRIMARY KEY,
  group_id   bigint NOT NULL,
  signature  text,
  created_at timestamp NOT NULL DEFAULT now()
);
