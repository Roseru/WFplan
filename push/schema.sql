PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS subscriptions (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, endpoint_hash TEXT NOT NULL UNIQUE,
 subscription TEXT NOT NULL, selection TEXT NOT NULL, settings TEXT NOT NULL,
 revision TEXT NOT NULL, updated INTEGER NOT NULL, last_test INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS jobs (
 id TEXT PRIMARY KEY, subscriber TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
 due INTEGER NOT NULL, starts INTEGER NOT NULL, payload TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 lease INTEGER NOT NULL DEFAULT 0, sent INTEGER
);
CREATE INDEX IF NOT EXISTS jobs_due ON jobs(state,due,lease);
CREATE INDEX IF NOT EXISTS jobs_subscriber ON jobs(subscriber);
CREATE INDEX IF NOT EXISTS subscriptions_revision ON subscriptions(revision);
