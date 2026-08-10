import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizationMemberships, userIdentities } from './identity.js';
import { organizations } from './meta.js';

/**
 * Wave 1 client core tables.
 * All tenant-owned; child → parent links use composite (organization_id, …) FKs.
 */

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    legalName: text('legal_name').notNull(),
    preferredName: text('preferred_name'),
    status: text('status').notNull().default('active'),
    /** Legacy operational tag: onboarding | maintenance | standard — not lifecycle status. */
    operationalStage: text('operational_stage'),
    /** Legacy age bridge — do not fabricate DOB from this. */
    ageYears: integer('age_years'),
    authorizedHoursWeekly: numeric('authorized_hours_weekly', { precision: 6, scale: 2 }),
    color: text('color'),
    borderColor: text('border_color'),
    textColor: text('text_color'),
    colorTheme: jsonb('color_theme'),
    avatar: text('avatar'),
    photoFileId: uuid('photo_file_id'),
    /** Legacy free-text diagnosis until structured Diagnosis rows are populated. */
    diagnosisText: text('diagnosis_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [unique('clients_org_id_unique').on(t.organizationId, t.id)],
);

export const caregivers = pgTable(
  'caregivers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    clientId: uuid('client_id').notNull(),
    name: text('name').notNull(),
    relationship: text('relationship'),
    phone: text('phone'),
    email: text('email'),
    isEmergencyContact: boolean('is_emergency_contact').notNull().default(false),
    isAuthorizedPickup: boolean('is_authorized_pickup').notNull().default(false),
    status: text('status').notNull().default('active'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [
    unique('caregivers_org_id_unique').on(t.organizationId, t.id),
    foreignKey({
      name: 'caregivers_client_org_fk',
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
  ],
);

export const consentAuthorities = pgTable(
  'consent_authorities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    clientId: uuid('client_id').notNull(),
    holderCaregiverId: uuid('holder_caregiver_id'),
    holderName: text('holder_name'),
    authorityType: text('authority_type').notNull(),
    status: text('status').notNull().default('active'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    evidenceFileId: uuid('evidence_file_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [
    unique('consent_authorities_org_id_unique').on(t.organizationId, t.id),
    foreignKey({
      name: 'consent_authorities_client_org_fk',
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    foreignKey({
      name: 'consent_authorities_caregiver_org_fk',
      columns: [t.organizationId, t.holderCaregiverId],
      foreignColumns: [caregivers.organizationId, caregivers.id],
    }),
  ],
);

export const diagnoses = pgTable(
  'diagnoses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    clientId: uuid('client_id').notNull(),
    code: text('code'),
    description: text('description'),
    status: text('status').notNull().default('active'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [
    unique('diagnoses_org_id_unique').on(t.organizationId, t.id),
    foreignKey({
      name: 'diagnoses_client_org_fk',
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
  ],
);

export const physicians = pgTable(
  'physicians',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    clientId: uuid('client_id').notNull(),
    name: text('name').notNull(),
    npi: text('npi'),
    roleCode: text('role_code'),
    phone: text('phone'),
    email: text('email'),
    status: text('status').notNull().default('active'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [
    unique('physicians_org_id_unique').on(t.organizationId, t.id),
    foreignKey({
      name: 'physicians_client_org_fk',
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
  ],
);

export const clientAssignments = pgTable(
  'client_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    clientId: uuid('client_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => userIdentities.id),
    membershipId: uuid('membership_id').notNull(),
    assignmentType: text('assignment_type').notNull(),
    narrowingFlags: jsonb('narrowing_flags'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer('row_version').notNull().default(1),
  },
  (t) => [
    unique('client_assignments_org_id_unique').on(t.organizationId, t.id),
    foreignKey({
      name: 'client_assignments_client_org_fk',
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    foreignKey({
      name: 'client_assignments_membership_org_fk',
      columns: [t.organizationId, t.membershipId],
      foreignColumns: [organizationMemberships.organizationId, organizationMemberships.id],
    }),
  ],
);

export const legacyIdMaps = pgTable(
  'legacy_id_maps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    entityType: text('entity_type').notNull(),
    legacyId: text('legacy_id').notNull(),
    postgresId: uuid('postgres_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('legacy_id_maps_org_id_unique').on(t.organizationId, t.id),
    unique('legacy_id_maps_org_entity_legacy_unique').on(
      t.organizationId,
      t.entityType,
      t.legacyId,
    ),
  ],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Caregiver = typeof caregivers.$inferSelect;
export type NewCaregiver = typeof caregivers.$inferInsert;
export type ConsentAuthority = typeof consentAuthorities.$inferSelect;
export type NewConsentAuthority = typeof consentAuthorities.$inferInsert;
export type Diagnosis = typeof diagnoses.$inferSelect;
export type NewDiagnosis = typeof diagnoses.$inferInsert;
export type Physician = typeof physicians.$inferSelect;
export type NewPhysician = typeof physicians.$inferInsert;
export type ClientAssignment = typeof clientAssignments.$inferSelect;
export type NewClientAssignment = typeof clientAssignments.$inferInsert;
export type LegacyIdMap = typeof legacyIdMaps.$inferSelect;
export type NewLegacyIdMap = typeof legacyIdMaps.$inferInsert;
