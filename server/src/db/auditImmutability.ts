/**
 * Append-only audit_entries: UPDATE/DELETE must fail at the database.
 * SQL is applied by drizzle/0001_wave1.sql; exported here for tests/reuse.
 */

export const AUDIT_ENTRIES_IMMUTABILITY_FUNCTION = `
CREATE OR REPLACE FUNCTION prevent_audit_entries_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_entries is immutable: % not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
`.trim();

export const AUDIT_ENTRIES_IMMUTABILITY_TRIGGERS = `
DROP TRIGGER IF EXISTS audit_entries_no_update ON audit_entries;
CREATE TRIGGER audit_entries_no_update
  BEFORE UPDATE ON audit_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_entries_mutation();

DROP TRIGGER IF EXISTS audit_entries_no_delete ON audit_entries;
CREATE TRIGGER audit_entries_no_delete
  BEFORE DELETE ON audit_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_entries_mutation();
`.trim();
