import { apiFetch } from '../api/client';
import { isApiDomain } from '../cutover';
import { Client } from '../../types';

export type ApiClientRecord = {
  id: string;
  name: string;
  legalName?: string;
  preferredName?: string | null;
  status: 'active' | 'inactive' | 'discharged';
  operationalStage?: 'onboarding' | 'maintenance' | 'standard' | null;
  age?: number | null;
  authorizedHours?: number;
  color?: string | null;
  borderColor?: string | null;
  textColor?: string | null;
  avatar?: string | null;
  diagnosis?: string | null;
  rowVersion?: number;
};

const DEFAULT_PALETTE = [
  { c: 'bg-cyan-100', b: 'border-cyan-400', t: 'text-cyan-900' },
  { c: 'bg-lime-100', b: 'border-lime-400', t: 'text-lime-900' },
  { c: 'bg-fuchsia-100', b: 'border-fuchsia-400', t: 'text-fuchsia-900' },
  { c: 'bg-orange-100', b: 'border-orange-400', t: 'text-orange-900' },
  { c: 'bg-teal-100', b: 'border-teal-400', t: 'text-teal-900' },
  { c: 'bg-violet-100', b: 'border-violet-400', t: 'text-violet-900' },
];

function paletteForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % DEFAULT_PALETTE.length;
  return DEFAULT_PALETTE[hash];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function operationalStatusFromStage(
  stage?: 'onboarding' | 'maintenance' | 'standard' | null,
): Client['status'] {
  if (stage === 'onboarding') return 'Onboarding';
  if (stage === 'maintenance') return 'Maintenance';
  return 'Active';
}

export function mapApiClientToClient(row: ApiClientRecord): Client {
  const palette = paletteForId(row.id);

  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar || initials(row.name),
    color: row.color || palette.c,
    borderColor: row.borderColor || palette.b,
    textColor: row.textColor || palette.t,
    diagnosis: row.diagnosis ?? undefined,
    lifecycleStatus: row.status,
    status: operationalStatusFromStage(row.operationalStage),
    authorizedHours: row.authorizedHours,
    age: row.age ?? undefined,
    rowVersion: row.rowVersion,
  };
}

function mapStatusToApi(
  status: Client['status'],
  lifecycleStatus?: Client['lifecycleStatus'],
): {
  status: 'active' | 'inactive' | 'discharged';
  operationalStage: 'onboarding' | 'maintenance' | 'standard' | null;
} {
  const lifecycle = lifecycleStatus ?? 'active';
  let operationalStage: 'onboarding' | 'maintenance' | 'standard' | null = 'standard';
  if (status === 'Onboarding') operationalStage = 'onboarding';
  else if (status === 'Maintenance') operationalStage = 'maintenance';

  return { status: lifecycle, operationalStage };
}

export type ClientSaveInput = {
  id?: string;
  name: string;
  diagnosis: string;
  status: Client['status'];
  lifecycleStatus?: Client['lifecycleStatus'];
  imageUrl?: string;
  authorizedHours?: number;
  age?: number;
};

export async function listClients(localClients: Client[]): Promise<Client[]> {
  if (!isApiDomain('clients')) {
    return localClients;
  }
  const res = await apiFetch<{ clients: ApiClientRecord[] }>('/api/v1/clients');
  return res.clients.map(mapApiClientToClient);
}

export async function getClient(id: string, localClients: Client[]): Promise<Client | null> {
  if (!isApiDomain('clients')) {
    return localClients.find((c) => c.id === id) ?? null;
  }
  const res = await apiFetch<{ client: ApiClientRecord }>(`/api/v1/clients/${id}`);
  return mapApiClientToClient(res.client);
}

export async function createClient(input: ClientSaveInput): Promise<Client> {
  const mapped = mapStatusToApi(input.status, input.lifecycleStatus);
  const res = await apiFetch<{ client: ApiClientRecord }>('/api/v1/clients', {
    method: 'POST',
    body: {
      legalName: input.name,
      preferredName: input.name,
      diagnosisText: input.diagnosis,
      ...mapped,
      authorizedHoursWeekly: input.authorizedHours ?? 15,
      ageYears: input.age ?? null,
      avatar: input.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase(),
    },
  });
  const client = mapApiClientToClient(res.client);
  if (input.imageUrl) client.imageUrl = input.imageUrl;
  return client;
}

export async function updateClient(
  id: string,
  input: ClientSaveInput,
  existing: Client,
): Promise<Client> {
  const mapped = mapStatusToApi(input.status, input.lifecycleStatus ?? existing.lifecycleStatus);
  const rowVersion = existing.rowVersion;
  if (rowVersion == null) {
    throw new Error('Client rowVersion missing; refetch before update.');
  }
  const res = await apiFetch<{ client: ApiClientRecord }>(`/api/v1/clients/${id}`, {
    method: 'PATCH',
    body: {
      legalName: input.name,
      preferredName: input.name,
      diagnosisText: input.diagnosis,
      operationalStage: mapped.operationalStage,
      rowVersion,
      avatar: input.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase(),
    },
  });
  const client = mapApiClientToClient(res.client);
  if (input.imageUrl) client.imageUrl = input.imageUrl;
  return client;
}

export async function lifecycleClient(
  id: string,
  existing: Client,
  status: 'active' | 'inactive' | 'discharged' = 'inactive',
): Promise<Client> {
  const rowVersion = existing.rowVersion;
  if (rowVersion == null) {
    throw new Error('Client rowVersion missing; refetch before lifecycle.');
  }
  const res = await apiFetch<{ client: ApiClientRecord }>(`/api/v1/clients/${id}/lifecycle`, {
    method: 'POST',
    body: { status, rowVersion },
  });
  return mapApiClientToClient(res.client);
}

export type ImportLocalResult = {
  legacyId: string;
  clientId: string;
  imported: boolean;
};

export async function importLocalClients(clients: Client[]): Promise<ImportLocalResult[]> {
  const res = await apiFetch<{ results: ImportLocalResult[] }>('/api/v1/clients/import-local', {
    method: 'POST',
    body: {
      clients: clients.map((c) => ({
        legacyId: c.id,
        name: c.name,
        status: c.lifecycleStatus ?? 'active',
        operationalStage:
          c.status === 'Onboarding'
            ? 'onboarding'
            : c.status === 'Maintenance'
              ? 'maintenance'
              : 'standard',
        age: c.age ?? null,
        authorizedHours: c.authorizedHours ?? null,
        color: c.color,
        borderColor: c.borderColor,
        textColor: c.textColor,
        avatar: c.avatar,
        diagnosis: c.diagnosis,
        guardianName: c.guardian?.name,
        guardianContact: c.guardian?.contact,
      })),
    },
  });
  return res.results;
}

export function saveClientLocal(
  localClients: Client[],
  input: ClientSaveInput,
): { clients: Client[]; client: Client } {
  if (input.id) {
    const existing = localClients.find((c) => c.id === input.id);
    if (!existing) throw new Error('Client not found');
    const updated: Client = {
      ...existing,
      name: input.name,
      diagnosis: input.diagnosis,
      status: input.status,
      lifecycleStatus: input.lifecycleStatus ?? existing.lifecycleStatus,
      imageUrl: input.imageUrl,
      avatar: input.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase(),
    };
    return {
      clients: localClients.map((c) => (c.id === input.id ? updated : c)),
      client: updated,
    };
  }

  const palette = DEFAULT_PALETTE[Math.floor(Math.random() * DEFAULT_PALETTE.length)];
  const id = input.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const newClient: Client = {
    id,
    name: input.name,
    avatar: input.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase(),
    color: palette.c,
    borderColor: palette.b,
    textColor: palette.t,
    diagnosis: input.diagnosis,
    status: input.status,
    lifecycleStatus: input.lifecycleStatus ?? 'active',
    imageUrl: input.imageUrl,
    authorizedHours: 15,
  };
  return { clients: [...localClients, newClient], client: newClient };
}

export function deleteClientLocal(localClients: Client[], id: string): Client[] {
  return localClients.filter((c) => c.id !== id);
}
