import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Shield, Award, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { listStaff, getStaff, StaffMember } from '../lib/repos/staffRepo';

export const StaffView: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    data: staff = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['staff'],
    queryFn: listStaff,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['staff', selectedId],
    queryFn: () => (selectedId ? getStaff(selectedId) : null),
    enabled: !!selectedId,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-6 flex gap-3 text-rose-700 max-w-md">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">Unable to load staff directory</div>
            <p className="text-xs mt-1 opacity-80">
              {error instanceof Error ? error.message : 'Check API connection and permissions.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-slate-900">Staff Directory</h1>
        <p className="text-slate-500 font-medium mt-1">
          {staff.length} team member{staff.length !== 1 ? 's' : ''} • credentials & functions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {staff.map((member: StaffMember) => (
            <button
              key={member.membershipId}
              onClick={() => setSelectedId(member.membershipId)}
              className={`w-full text-left bg-white rounded-xl border p-4 flex items-center gap-4 transition-all hover:shadow-md ${
                selectedId === member.membershipId
                  ? 'border-indigo-300 ring-2 ring-indigo-100'
                  : 'border-slate-200'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                {member.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 truncate">{member.name}</div>
                <div className="text-xs text-slate-500 truncate">{member.email}</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {member.employmentType}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      member.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-300 shrink-0" />
            </button>
          ))}

          {staff.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No staff records found</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 min-h-[300px]">
          {!selectedId && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <Users size={40} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">Select a staff member to view details</p>
            </div>
          )}

          {selectedId && detailLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-indigo-500" size={24} />
            </div>
          )}

          {selectedId && detail && !detailLoading && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-serif font-bold text-slate-900">{detail.staff.name}</h2>
                <p className="text-sm text-slate-500">{detail.staff.email}</p>
                {detail.staff.jobTitle && (
                  <p className="text-xs text-indigo-600 font-bold mt-1">{detail.staff.jobTitle}</p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-indigo-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Operational Functions
                  </h3>
                </div>
                {detail.functions.length === 0 ? (
                  <p className="text-xs text-slate-400">No functions assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {detail.functions.map((fn) => (
                      <span
                        key={fn.id}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100"
                        title={fn.scopeMode}
                      >
                        {fn.name || fn.code}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award size={16} className="text-amber-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Credentials
                  </h3>
                </div>
                {detail.credentials.length === 0 ? (
                  <p className="text-xs text-slate-400">No credentials on file</p>
                ) : (
                  <div className="space-y-2">
                    {detail.credentials.map((cred) => (
                      <div
                        key={cred.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div>
                          <div className="text-sm font-bold text-slate-800">{cred.name || cred.code}</div>
                          {cred.number && (
                            <div className="text-xs text-slate-500 font-mono">{cred.number}</div>
                          )}
                        </div>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            cred.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {cred.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
