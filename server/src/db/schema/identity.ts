import {
  date,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './meta.js';

/**
 * Wave 1 identity + staff/authZ catalog tables.
 * UserIdentity is global; membership/grants/credentials are tenant-owned.
 */

export const userIdentities = pgTable('user_identities', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** Store normalized (lowercase/trimmed) email only. */
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  rowVersion: integer('row_version').notNull().default(1),
});

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => userIdentities.id),
  organizationId: uuid('organization_id').references(() => organizations.id),
  tokenHash: text('token_hash').notNull(),
  csrfTokenHash: text('csrf_token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  deviceMeta: jsonb('device_meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => userIdentities.id),
    employmentType: text('employment_type').notNull(),
    status: text('status').notNull().default('active'),
    jobTitle: text('job_title'),
    hireDate: date('hire_date'),
    terminatedAt: timestamp('terminated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [
    unique('organization_memberships_org_id_unique').on(t.organizationId, t.id),
    unique('organization_memberships_org_user_unique').on(t.organizationId, t.userId),
  ],
);

/**
 * System catalog rows have organization_id NULL; org-custom rows set it.
 * `code` is globally unique (system seeds + org-custom must not collide).
 */
export const operationalFunctions = pgTable(
  'operational_functions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('operational_functions_org_id_unique').on(t.organizationId, t.id)],
);

export const functionGrants = pgTable(
  'function_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    membershipId: uuid('membership_id').notNull(),
    functionId: uuid('function_id')
      .notNull()
      .references(() => operationalFunctions.id),
    scopeMode: text('scope_mode').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [
    unique('function_grants_org_id_unique').on(t.organizationId, t.id),
    foreignKey({
      name: 'function_grants_membership_org_fk',
      columns: [t.organizationId, t.membershipId],
      foreignColumns: [organizationMemberships.organizationId, organizationMemberships.id],
    }),
  ],
);

export const credentialDefinitions = pgTable(
  'credential_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [
    unique('credential_definitions_org_id_unique').on(t.organizationId, t.id),
    unique('credential_definitions_org_code_unique').on(t.organizationId, t.code),
  ],
);

export const userCredentials = pgTable(
  'user_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => userIdentities.id),
    credentialDefinitionId: uuid('credential_definition_id').notNull(),
    number: text('number'),
    issuingBody: text('issuing_body'),
    effectiveOn: date('effective_on'),
    expiresOn: date('expires_on'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [
    unique('user_credentials_org_id_unique').on(t.organizationId, t.id),
    foreignKey({
      name: 'user_credentials_definition_org_fk',
      columns: [t.organizationId, t.credentialDefinitionId],
      foreignColumns: [credentialDefinitions.organizationId, credentialDefinitions.id],
    }),
  ],
);

export type UserIdentity = typeof userIdentities.$inferSelect;
export type NewUserIdentity = typeof userIdentities.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type NewOrganizationMembership = typeof organizationMemberships.$inferInsert;
export type OperationalFunction = typeof operationalFunctions.$inferSelect;
export type NewOperationalFunction = typeof operationalFunctions.$inferInsert;
export type FunctionGrant = typeof functionGrants.$inferSelect;
export type NewFunctionGrant = typeof functionGrants.$inferInsert;
export type CredentialDefinition = typeof credentialDefinitions.$inferSelect;
export type NewCredentialDefinition = typeof credentialDefinitions.$inferInsert;
export type UserCredential = typeof userCredentials.$inferSelect;
export type NewUserCredential = typeof userCredentials.$inferInsert;
