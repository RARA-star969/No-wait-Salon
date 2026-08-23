# PostgreSQL persistence migration

Production uses the pooled PostgreSQL URL in `DATABASE_URL`. Local development continues to use SQLite when that variable is absent.

## Startup behavior

1. Repeatable migrations in `server/migrations.ts` create missing PostgreSQL tables and indexes.
2. The runtime creates a SQLite safety backup before synchronization.
3. If PostgreSQL contains salon data, it hydrates the local compatibility cache from PostgreSQL.
4. On the first PostgreSQL start only, existing SQLite rows are imported transactionally with their original IDs.
5. Mutations are persisted back to the relational PostgreSQL tables. Queue, booking, admin salon edits, profiles and sessions use the same API contracts as before.

## Rollback

1. Keep the PostgreSQL database and `DATABASE_URL` unchanged so no PostgreSQL data is deleted.
2. In Render, remove `DATABASE_URL` from the web service and redeploy the last known-good commit.
3. Restore the pre-migration SQLite backup to `DATA_DIR/no-wait-salon.db` if a temporary SQLite rollback needs the pre-migration rows.
4. After diagnosing the issue, restore `DATABASE_URL` and redeploy. PostgreSQL remains the durable source and hydrates the compatibility cache again.

Never commit a connection string or a database backup containing customer data.
