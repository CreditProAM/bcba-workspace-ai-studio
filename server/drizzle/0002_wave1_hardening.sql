-- Wave 1.1 hardening: clinical authority, constraints, CHECKs.
-- Do not edit 0001_wave1.sql.

ALTER TABLE "credential_definitions"
  ADD COLUMN IF NOT EXISTS "clinical_authority" text NOT NULL DEFAULT 'NONE';
--> statement-breakpoint

UPDATE "credential_definitions"
SET "clinical_authority" = 'BCBA'
WHERE "code" = 'BCBA' AND "clinical_authority" = 'NONE';
--> statement-breakpoint

UPDATE "credential_definitions"
SET "clinical_authority" = 'RBT'
WHERE "code" = 'RBT' AND "clinical_authority" = 'NONE';
--> statement-breakpoint

UPDATE "credential_definitions"
SET "clinical_authority" = 'BCABA'
WHERE "code" = 'BCaBA' AND "clinical_authority" = 'NONE';
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "credential_definitions"
    ADD CONSTRAINT "credential_definitions_clinical_authority_check"
    CHECK ("clinical_authority" IN ('NONE', 'RBT', 'BCABA', 'BCBA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_token_hash_unique" UNIQUE ("token_hash");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "organization_memberships"
    ADD CONSTRAINT "organization_memberships_status_check"
    CHECK ("status" IN ('active', 'inactive', 'terminated'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "organization_memberships"
    ADD CONSTRAINT "organization_memberships_employment_type_check"
    CHECK ("employment_type" IN ('employee', 'contractor'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "function_grants"
    ADD CONSTRAINT "function_grants_scope_mode_check"
    CHECK ("scope_mode" IN ('ORGANIZATION', 'ASSIGNED_CLIENTS'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "clients"
    ADD CONSTRAINT "clients_status_check"
    CHECK ("status" IN ('active', 'inactive', 'discharged'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "user_credentials"
    ADD CONSTRAINT "user_credentials_status_check"
    CHECK ("status" IN ('active', 'expired', 'suspended', 'revoked'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Support composite FK (org, membership, user) for ClientAssignment integrity
DO $$ BEGIN
  ALTER TABLE "organization_memberships"
    ADD CONSTRAINT "organization_memberships_org_id_user_uq"
    UNIQUE ("organization_id", "id", "user_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "client_assignments"
    ADD CONSTRAINT "client_assignments_membership_user_fk"
    FOREIGN KEY ("organization_id", "membership_id", "user_id")
    REFERENCES "organization_memberships" ("organization_id", "id", "user_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "function_grants_open_unique"
  ON "function_grants" ("organization_id", "membership_id", "function_id")
  WHERE "effective_to" IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "client_assignments_open_unique"
  ON "client_assignments" ("organization_id", "client_id", "membership_id", "assignment_type")
  WHERE "status" = 'active' AND "effective_to" IS NULL;
