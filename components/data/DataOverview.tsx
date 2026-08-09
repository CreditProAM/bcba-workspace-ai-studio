import React, { useMemo } from 'react';
import { TrendingUp, Users, CalendarCheck2, ShieldCheck } from 'lucide-react';
import { Client, CalendarEvent, ServicePlan } from '../../types';
import { ClinicalProgress } from './ClinicalProgress';

interface DataOverviewProps {
  clients: Client[];
  events: CalendarEvent[];
  utilizationMetrics: { scheduled: number; total: number; percentage: number };
  servicePlans: ServicePlan[];
}

/**
 * Data & Progress overview. Every number here is computed directly from appState
 * (clients/events already in localStorage) -- nothing is AI-generated or mocked.
 * Per-client trend charts (ported from aba_tool_genie's Analytics/ProgressChart)
 * land here in a later phase once session-level goal data exists (see Notes/DataCollection).
 */
export const DataOverview: React.FC<DataOverviewProps> = ({ clients, events, utilizationMetrics, servicePlans }) => {
  const now = new Date();

  const stats = useMemo(() => {
    const active = clients.filter(c => c.status === 'Active').length;
    const onboarding = clients.filter(c => c.status === 'Onboarding').length;

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const sessionsThisWeek = events.filter(e => e.start >= weekStart && e.start < weekEnd && e.serviceType === 'Direct 1:1').length;

    const supervisionCompliance = clients.map(c => {
      const clientEvents = events.filter(e => e.clientId === c.id);
      const therapyMin = clientEvents.filter(e => e.serviceType === 'Direct 1:1').reduce((a, e) => a + (e.end.getTime() - e.start.getTime()) / 60000, 0);
      const supMin = clientEvents.filter(e => e.serviceType === 'RBT Supervision').reduce((a, e) => a + (e.end.getTime() - e.start.getTime()) / 60000, 0);
      const pct = therapyMin > 0 ? (supMin / therapyMin) * 100 : 0;
      return { client: c, compliant: pct >= 5, percentage: pct };
    });
    const nonCompliant = supervisionCompliance.filter(s => !s.compliant && s.client.status === 'Active');

    return { active, onboarding, sessionsThisWeek, nonCompliant };
  }, [clients, events]);

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">Data &amp; Progress</h1>
          <p className="text-slate-500 font-medium mt-1">A live snapshot of your caseload, computed from the current schedule and client roster.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
              <Users size={14} /> Active Caseload
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.active}</div>
            <div className="text-xs text-slate-400 mt-1">{stats.onboarding} onboarding</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
              <CalendarCheck2 size={14} /> Sessions This Week
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.sessionsThisWeek}</div>
            <div className="text-xs text-slate-400 mt-1">Direct 1:1 sessions scheduled</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
              <TrendingUp size={14} /> Weekly Utilization
            </div>
            <div className="text-3xl font-bold text-slate-900">{utilizationMetrics.percentage.toFixed(0)}%</div>
            <div className="text-xs text-slate-400 mt-1">{utilizationMetrics.scheduled}h of {utilizationMetrics.total}h authorized</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
              <ShieldCheck size={14} /> Supervision (5%)
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.nonCompliant.length}</div>
            <div className="text-xs text-slate-400 mt-1">active client{stats.nonCompliant.length === 1 ? '' : 's'} below target</div>
          </div>
        </div>

        {/* The itemized per-client "Needs Attention" list previously here has
            been consolidated into the shared clinical attention engine
            (utils/clinicalAttention.ts -> Today / Needs My Attention), which
            now surfaces the same supervision-below-target signal with the
            same underlying calculation. Keeping a second itemized list here
            would create two competing views of one signal, so only the
            caseload-wide count card above (and the chart below) remain. */}

        <ClinicalProgress clients={clients} servicePlans={servicePlans} />
      </div>
    </div>
  );
};
