import { AppState, CalendarEvent, Client, SessionNote, ServicePlan } from '../types';

export type AttentionPriority = 'high' | 'medium' | 'low';

export type AttentionItemType =
  | 'pending_note'
  | 'service_plan_review'
  | 'program_no_data'
  | 'program_stale_data'
  | 'supervision_below_target';

export interface AttentionItem {
  id: string;
  type: AttentionItemType;
  priority: AttentionPriority;
  title: string;
  subtitle: string;
  clientId: string;
  clientName: string;
  client: Client;
  noteId?: string;
  note?: SessionNote;
  planId?: string;
  servicePlan?: ServicePlan;
  programId?: string;
  programName?: string;
  lastDataDate?: string;
  timestamp?: string;
  supervisionPercentage?: number;
}

export interface ClinicalAttentionResult {
  items: AttentionItem[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  pendingNotesCount: number;
  servicePlanReviewsCount: number;
  staleOrNoDataCount: number;
  supervisionBelowTargetCount: number;
}

// The BACB 5% supervision-ratio target used everywhere else this ratio is
// already surfaced (ClientProfilePanel's supervision ring, SupervisionView's
// compliance table, DataOverview's caseload-wide count).
const SUPERVISION_TARGET_PCT = 5;

/**
 * Same supervision-ratio math already used in ClientProfilePanel.tsx and
 * DataOverview.tsx (supervision hours / direct-1:1 therapy hours, as a
 * percentage). Extracted here rather than reimplemented so this module has
 * exactly one copy of the calculation to reuse, matching how
 * utils/clinicalProgress.ts consolidated the equivalent duplication for
 * progress data.
 */
function calculateSupervisionCompliance(clientId: string, events: CalendarEvent[]): {
  therapyHours: number;
  supervisionHours: number;
  compliancePct: number;
} {
  const clientEvents = events.filter(e => e.clientId === clientId);
  const therapyHours = clientEvents
    .filter(e => e.serviceType === 'Direct 1:1')
    .reduce((acc, e) => acc + (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60), 0);
  const supervisionHours = clientEvents
    .filter(e => e.serviceType === 'RBT Supervision')
    .reduce((acc, e) => acc + (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60), 0);
  const compliancePct = therapyHours > 0 ? (supervisionHours / therapyHours) * 100 : 0;
  return { therapyHours, supervisionHours, compliancePct };
}

export function deriveClinicalAttention(appState: AppState, now: Date = new Date()): ClinicalAttentionResult {
  const items: AttentionItem[] = [];
  const clients = appState.clients || [];
  const servicePlans = appState.servicePlans || [];
  const events = appState.events || [];

  for (const client of clients) {
    // 1. Pending Session Notes requiring BCBA review
    const sessionNotes = client.sessionNotes || [];
    for (const note of sessionNotes) {
      if (note.status === 'Pending Review') {
        // NOTE ON TIMESTAMP FALLBACK: SessionNote has no dedicated
        // "submitted for review at" timestamp in the data model -- only a
        // date-only `date` field (the clinical session date). There is no
        // honest way to know exactly when a note entered the review queue,
        // so `note.date` is used here as the best available proxy. This is
        // an approximation, not the real queue-entry time: a note dated
        // today could have been submitted seconds ago or hours ago, and the
        // date-only granularity means "hoursElapsed" is really closer to
        // "calendar days since the session" than a precise duration. If a
        // real review-submission timestamp is ever added to SessionNote,
        // this should switch to that field instead.
        let noteTime: number;
        if (note.date) {
          const parsed = new Date(note.date);
          noteTime = isNaN(parsed.getTime()) ? now.getTime() : parsed.getTime();
        } else {
          noteTime = now.getTime();
        }

        const hoursElapsed = (now.getTime() - noteTime) / (1000 * 60 * 60);
        const priority: AttentionPriority = hoursElapsed > 48 ? 'high' : 'medium';

        items.push({
          id: `att_note_${client.id}_${note.id}`,
          type: 'pending_note',
          priority,
          title: 'Session Note Pending Review',
          subtitle: `${client.name} • ${note.date || 'Undated'}`,
          clientId: client.id,
          clientName: client.name,
          client,
          noteId: note.id,
          note,
          timestamp: note.date,
        });
      }
    }

    // 2. Service Plan reviews (overdue or upcoming)
    const activePlan = servicePlans.find(p => p.clientId === client.id && p.status === 'active');
    if (activePlan && activePlan.reviewDate) {
      const revDate = new Date(activePlan.reviewDate);
      if (!isNaN(revDate.getTime())) {
        const daysDiff = (revDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff < 0) {
          items.push({
            id: `att_plan_${client.id}_${activePlan.id}`,
            type: 'service_plan_review',
            priority: 'high',
            title: 'Service Plan Review Overdue',
            subtitle: `${client.name} • Scheduled for ${activePlan.reviewDate}`,
            clientId: client.id,
            clientName: client.name,
            client,
            planId: activePlan.id,
            servicePlan: activePlan,
            timestamp: activePlan.reviewDate,
          });
        } else if (daysDiff <= 14) {
          items.push({
            id: `att_plan_${client.id}_${activePlan.id}`,
            type: 'service_plan_review',
            priority: 'medium',
            title: 'Service Plan Review Due Soon',
            subtitle: `${client.name} • Due ${activePlan.reviewDate}`,
            clientId: client.id,
            clientName: client.name,
            client,
            planId: activePlan.id,
            servicePlan: activePlan,
            timestamp: activePlan.reviewDate,
          });
        } else if (daysDiff <= 30) {
          items.push({
            id: `att_plan_${client.id}_${activePlan.id}`,
            type: 'service_plan_review',
            priority: 'low',
            title: 'Upcoming Service Plan Review',
            subtitle: `${client.name} • Due ${activePlan.reviewDate}`,
            clientId: client.id,
            clientName: client.name,
            client,
            planId: activePlan.id,
            servicePlan: activePlan,
            timestamp: activePlan.reviewDate,
          });
        }
      }
    }

    // 3. Active Programs with no data or stale data (14+ days)
    if (activePlan) {
      const activePrograms = activePlan.categories.flatMap(c => c.programs).filter(p => p.status === 'active');
      for (const program of activePrograms) {
        const programNoteDates: string[] = [];
        for (const note of sessionNotes) {
          if (note.programData?.some(pd => pd.programId === program.id)) {
            programNoteDates.push(note.date);
          }
        }

        if (programNoteDates.length === 0) {
          items.push({
            id: `att_prog_nodata_${client.id}_${program.id}`,
            type: 'program_no_data',
            priority: 'low',
            title: 'Active Program Has No Data',
            subtitle: `${client.name} • ${program.name}`,
            clientId: client.id,
            clientName: client.name,
            client,
            programId: program.id,
            programName: program.name,
          });
        } else {
          const sortedDates = [...programNoteDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          const latestDate = new Date(sortedDates[0]);
          if (!isNaN(latestDate.getTime())) {
            const daysSinceLastData = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastData >= 14) {
              items.push({
                id: `att_prog_stale_${client.id}_${program.id}`,
                type: 'program_stale_data',
                priority: 'low',
                title: 'Program Data Stale (14+ Days)',
                subtitle: `${client.name} • ${program.name} (Last data: ${sortedDates[0]})`,
                clientId: client.id,
                clientName: client.name,
                client,
                programId: program.id,
                programName: program.name,
                lastDataDate: sortedDates[0],
                timestamp: sortedDates[0],
              });
            }
          }
        }
      }
    }

    // 4. Supervision below the established 5% BACB target -- informational,
    // not a compliance/legal determination. Reuses the exact ratio math
    // already shown to the user in ClientProfilePanel and DataOverview,
    // scoped to Active clients only to match the existing caseload-wide
    // "below target" list on the Data tab.
    if (client.status === 'Active') {
      const { therapyHours, supervisionHours, compliancePct } = calculateSupervisionCompliance(client.id, events);
      if (compliancePct < SUPERVISION_TARGET_PCT) {
        items.push({
          id: `att_supervision_${client.id}`,
          type: 'supervision_below_target',
          priority: 'medium',
          title: 'Supervision Below Target',
          subtitle: `${client.name} • ${compliancePct.toFixed(1)}% of ${SUPERVISION_TARGET_PCT}% target (${supervisionHours.toFixed(1)} of ${therapyHours.toFixed(1)} therapy hrs)`,
          clientId: client.id,
          clientName: client.name,
          client,
          supervisionPercentage: compliancePct,
        });
      }
    }
  }

  const priorityOrder: Record<AttentionPriority, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const highCount = items.filter(i => i.priority === 'high').length;
  const mediumCount = items.filter(i => i.priority === 'medium').length;
  const lowCount = items.filter(i => i.priority === 'low').length;
  const pendingNotesCount = items.filter(i => i.type === 'pending_note').length;
  const servicePlanReviewsCount = items.filter(i => i.type === 'service_plan_review').length;
  const staleOrNoDataCount = items.filter(i => i.type === 'program_no_data' || i.type === 'program_stale_data').length;
  const supervisionBelowTargetCount = items.filter(i => i.type === 'supervision_below_target').length;

  return {
    items,
    highCount,
    mediumCount,
    lowCount,
    pendingNotesCount,
    servicePlanReviewsCount,
    staleOrNoDataCount,
    supervisionBelowTargetCount,
  };
}
