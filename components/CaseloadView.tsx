
import React, { useState } from 'react';
import { Client } from '../types';
import { Plus, MoreHorizontal, Activity, MapPin, Search, Filter } from 'lucide-react';

interface CaseloadViewProps {
  clients: Client[];
  onAddClient: () => void;
  onClientClick: (client: Client) => void;
}

export const CaseloadView: React.FC<CaseloadViewProps> = ({ clients, onAddClient, onClientClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Onboarding' | 'Maintenance'>('ALL');

  const filteredClients = clients.filter(client => {
      const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            client.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || client.status === statusFilter;
      
      return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Client['status']) => {
    switch (status) {
        case 'Active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'Onboarding': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'Maintenance': return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">Caseload Management</h1>
          <p className="text-slate-500 font-medium mt-1">
             {clients.filter(c => c.status === 'Active').length} Active • {clients.filter(c => c.status === 'Onboarding').length} Onboarding
          </p>
        </div>
        
        <div className="flex gap-3">
            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search clients..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
                />
            </div>

            {/* Filter */}
            <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                    <Filter size={16} />
                    <span>{statusFilter === 'ALL' ? 'All Status' : statusFilter}</span>
                </button>
                <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl p-1 hidden group-hover:block z-20">
                    {['ALL', 'Active', 'Onboarding', 'Maintenance'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s as any)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 ${statusFilter === s ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}
                        >
                            {s === 'ALL' ? 'View All' : s}
                        </button>
                    ))}
                </div>
            </div>

            <button 
            onClick={onAddClient}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 font-bold text-sm"
            >
            <Plus size={18} strokeWidth={1.5} />
            <span className="hidden md:inline">New Client</span>
            </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map(client => {
          return (
            <div 
                key={client.id} 
                onClick={() => onClientClick(client)}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all relative overflow-hidden group cursor-pointer"
            >
              <div className={`absolute top-0 left-0 w-full h-1.5 ${client.color.replace('bg-', 'bg-').replace('100', '400')}`}></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  {client.imageUrl ? (
                    <img 
                      src={client.imageUrl} 
                      alt={client.name} 
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-100 shadow-sm bg-slate-50"
                    />
                  ) : (
                    <div className={`w-14 h-14 rounded-2xl ${client.color} flex items-center justify-center text-lg font-bold ${client.textColor} border ${client.borderColor}`}>
                      {client.avatar}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{client.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${getStatusColor(client.status)}`}>
                            {client.status}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">ID: #{client.id.toUpperCase().substring(0,6)}</span>
                    </div>
                  </div>
                </div>
                <button className="text-slate-300 hover:text-slate-600 transition-colors">
                  <MoreHorizontal size={20} strokeWidth={1.5} />
                </button>
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Activity size={16} strokeWidth={1.5} className="text-slate-400" />
                    <span>{client.diagnosis || 'Diagnosis Pending'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                    <MapPin size={16} strokeWidth={1.5} className="text-slate-400" />
                    <span>Home & Clinic</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        <button onClick={onAddClient} className="rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:text-indigo-500 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group min-h-[200px]">
            <div className="w-16 h-16 rounded-full bg-slate-100 group-hover:bg-white flex items-center justify-center transition-colors">
                <Plus size={32} strokeWidth={1.5} />
            </div>
            <span className="font-bold">Add New Client</span>
        </button>
      </div>
    </div>
  );
};
