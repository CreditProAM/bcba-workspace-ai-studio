import { Client } from '../types';

/** Clinical fields kept locally when client demographics live in the API. */
export type ClinicalOverlayFields = Pick<
  Client,
  | 'sessionNotes'
  | 'assessments'
  | 'parentTrainingLogs'
  | 'goals'
  | 'targetBehaviors'
  | 'replacementBehaviors'
  | 'interventions'
  | 'guardian'
>;

export type ClinicalOverlayMap = Record<string, ClinicalOverlayFields>;

export function extractClinicalOverlay(clients: Client[]): ClinicalOverlayMap {
  const overlay: ClinicalOverlayMap = {};
  for (const c of clients) {
    const fields: ClinicalOverlayFields = {};
    if (c.sessionNotes?.length) fields.sessionNotes = c.sessionNotes;
    if (c.assessments?.length) fields.assessments = c.assessments;
    if (c.parentTrainingLogs?.length) fields.parentTrainingLogs = c.parentTrainingLogs;
    if (c.goals?.length) fields.goals = c.goals;
    if (c.targetBehaviors?.length) fields.targetBehaviors = c.targetBehaviors;
    if (c.replacementBehaviors?.length) fields.replacementBehaviors = c.replacementBehaviors;
    if (c.interventions?.length) fields.interventions = c.interventions;
    if (c.guardian) fields.guardian = c.guardian;
    if (Object.keys(fields).length > 0) overlay[c.id] = fields;
  }
  return overlay;
}

export function mergeClientsWithOverlay(
  apiClients: Client[],
  overlay: ClinicalOverlayMap,
): Client[] {
  return apiClients.map((c) => ({
    ...c,
    ...(overlay[c.id] ?? {}),
  }));
}

export function overlayFromClient(client: Client): ClinicalOverlayFields | undefined {
  const fields: ClinicalOverlayFields = {};
  if (client.sessionNotes?.length) fields.sessionNotes = client.sessionNotes;
  if (client.assessments?.length) fields.assessments = client.assessments;
  if (client.parentTrainingLogs?.length) fields.parentTrainingLogs = client.parentTrainingLogs;
  if (client.goals?.length) fields.goals = client.goals;
  if (client.targetBehaviors?.length) fields.targetBehaviors = client.targetBehaviors;
  if (client.replacementBehaviors?.length)
    fields.replacementBehaviors = client.replacementBehaviors;
  if (client.interventions?.length) fields.interventions = client.interventions;
  if (client.guardian) fields.guardian = client.guardian;
  return Object.keys(fields).length > 0 ? fields : undefined;
}

export function applyOverlayToMap(
  map: ClinicalOverlayMap,
  clientId: string,
  client: Client,
): ClinicalOverlayMap {
  const fields = overlayFromClient(client);
  if (!fields) {
    const next = { ...map };
    delete next[clientId];
    return next;
  }
  return { ...map, [clientId]: fields };
}
