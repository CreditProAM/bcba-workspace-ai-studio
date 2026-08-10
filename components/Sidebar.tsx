
import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  UsersRound,
  NotebookPen,
  ClipboardCheck,
  LineChart,
  Puzzle as ToolkitIcon,
  ActivitySquare,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  LogOut,
  UserCog,
} from 'lucide-react';
import { User } from '../types';
import type { PrimaryTab } from '../App';
import { isApiDomain } from '../lib/cutover';

interface SidebarProps {
  onSettingsClick?: () => void;
  activeTab: PrimaryTab;
  onTabChange: (tab: PrimaryTab) => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    onSettingsClick,
    activeTab,
    onTabChange,
    currentUser,
    onLogout,
}) => {
  // Initialize state from localStorage or default to false (expanded)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('bcba_sidebar_collapsed');
      return saved === 'true';
    } catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem('bcba_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  // Primary workflow navigation: Today -> Caseload -> Notes -> Supervision -> Data -> Toolkit.
  // Client detail is intentionally NOT a top-level item; it opens from Caseload (or Today's roster).
  const navItems = [
    { id: 'today', icon: CalendarClock, label: 'Today' },
    { id: 'caseload', icon: UsersRound, label: 'Caseload' },
    { id: 'notes', icon: NotebookPen, label: 'Notes' },
    { id: 'supervision', icon: ClipboardCheck, label: 'Supervision' },
    { id: 'data', icon: LineChart, label: 'Data' },
    { id: 'toolkit', icon: ToolkitIcon, label: 'Toolkit' },
    ...(isApiDomain('staff') ? [{ id: 'staff', icon: UserCog, label: 'Staff' }] : []),
  ];

  // Secondary/utility items: available, but intentionally not part of the primary 6-item workflow nav.
  const bottomItems = [
    { id: 'activity', icon: ActivitySquare, label: 'Activity', onClick: () => onTabChange('activity') },
    { id: 'settings', icon: SlidersHorizontal, label: 'Settings', onClick: onSettingsClick },
  ];

  return (
    <div 
      className={`
        relative h-full bg-slate-900 border-r border-slate-800 flex flex-col py-6 shrink-0 z-50
        transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
        ${isCollapsed ? 'w-20 items-center px-0' : 'w-64 px-4'}
      `}
    >
      
      {/* Header / Logo */}
      <div className={`flex items-center mb-10 transition-all duration-300 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-fuchsia-900/50">
           <Puzzle className="text-white" size={20} strokeWidth={1.5} />
        </div>
        
        <div className={`ml-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
           <h1 className="font-serif text-xl text-white font-bold tracking-tight whitespace-nowrap">BCBA</h1>
           <p className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-widest whitespace-nowrap">Workspace</p>
        </div>
      </div>
      
      {/* Navigation Items */}
      <div className="flex-1 flex flex-col gap-2 w-full">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.label}
              onClick={() => onTabChange(item.id as any)}
              title={isCollapsed ? item.label : ''}
              className={`
                flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative
                ${isCollapsed ? 'justify-center mx-3 w-10 h-10 p-0' : 'w-full'}
                ${isActive 
                  ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/30' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}
              `}
            >
              <item.icon size={22} strokeWidth={1.5} className="shrink-0" />
              
              <span className={`
                text-sm font-medium tracking-wide whitespace-nowrap transition-all duration-300
                ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}
              `}>
                {item.label}
              </span>

              {/* Tooltip for collapsed mode */}
              {isCollapsed && (
                 <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700">
                    {item.label}
                    {/* Tiny arrow */}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-slate-800"></div>
                 </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-2 w-full mb-4 pt-4 border-t border-slate-800/50">
        {bottomItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            title={isCollapsed ? item.label : ''}
            className={`
                flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative
                ${isCollapsed ? 'justify-center mx-3 w-10 h-10 p-0' : 'w-full'}
                text-slate-400 hover:text-white hover:bg-slate-800
            `}
          >
            <item.icon size={22} strokeWidth={1.5} className="shrink-0" />
            <span className={`
                text-sm font-medium tracking-wide whitespace-nowrap transition-all duration-300
                ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}
            `}>
                {item.label}
            </span>
             {isCollapsed && (
                 <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700">
                    {item.label}
                 </div>
              )}
          </button>
        ))}
        
        {/* User Profile / Logout */}
        {currentUser && (
           <div className={`
              mt-2 p-2 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center gap-3 transition-all duration-300
              ${isCollapsed ? 'justify-center mx-3 flex-col gap-1 p-1' : 'mx-0'}
           `}>
               <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {currentUser.avatar || currentUser.name.charAt(0)}
               </div>
               
               <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 h-0 opacity-0' : 'w-auto opacity-100'}`}>
                   <div className="text-xs font-bold text-white truncate max-w-[120px]">{currentUser.name}</div>
                   <div className="text-[10px] text-slate-400">BCBA</div>
               </div>

               <button 
                  onClick={onLogout}
                  className={`
                     text-slate-400 hover:text-rose-400 transition-colors
                     ${isCollapsed ? 'mt-1' : 'ml-auto'}
                  `}
                  title="Sign Out"
               >
                  <LogOut size={16} strokeWidth={1.5} />
               </button>
           </div>
        )}

        {/* Collapse Toggle Button */}
        <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`
                flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-slate-800 text-slate-500 hover:text-white mt-2
                ${isCollapsed ? 'justify-center mx-3' : 'px-3'}
            `}
        >
            {isCollapsed ? <PanelLeftOpen size={20} strokeWidth={1.5} /> : <PanelLeftClose size={20} strokeWidth={1.5} />}
            <span className={`
                text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all duration-300
                ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}
            `}>
                Collapse
            </span>
        </button>

      </div>
    </div>
  );
};
