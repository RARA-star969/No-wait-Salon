import React from 'react';
import { Scissors, RotateCcw, Smartphone, Store, Columns, Bell } from 'lucide-react';
import { ViewMode } from '../types';
import { ui } from './ui';

interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onReset: () => void;
  notificationCount: number;
  onOpenNotifications: () => void;
  permissionStatus: NotificationPermission | 'unsupported';
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  setViewMode,
  onReset,
  notificationCount,
  onOpenNotifications,
  permissionStatus,
}) => {
  return (
    <header className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-[#E1E7E6] pb-4 sm:flex-row sm:items-center">
      {/* Brand */}
      <div className="flex items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F766E] text-white">
          <Scissors className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-bold tracking-[-0.035em] text-[#17201F]">No-Wait Salon</span>
            <span className="rounded-md bg-[#E7F5F2] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#0F766E]">
              Live demo
            </span>
          </div>
          <p className="text-xs text-[#6F7C7A] font-medium mt-0.5">
            Live queue synchronization with real-time push alerts
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-end">
        {/* Notifications Bell */}
        <button
          id="header-notification-btn"
          onClick={onOpenNotifications}
          className={`${ui.secondaryButton} relative flex items-center gap-1.5 px-3 py-2 text-xs`}
          title="Push Notification Center"
        >
          <Bell className="w-3.5 h-3.5 text-[#0F766E]" />
          <span className="hidden sm:inline">Alerts</span>
          {notificationCount > 0 && (
            <span
              id="header-notification-badge"
              className="w-5 h-5 rounded-full bg-[#0F766E] text-white text-[10px] font-bold flex items-center justify-center -mr-1"
            >
              {notificationCount}
            </span>
          )}
          {permissionStatus === 'granted' && notificationCount === 0 && (
            <span className="w-2 h-2 rounded-full bg-[#0F766E]" title="Push enabled" />
          )}
        </button>

        {/* Mode Selector */}
        <div className="inline-flex rounded-xl border border-[#E1E7E6] bg-[#EEF3F2] p-1">
          <button
            id="viewmode-split-btn"
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'split'
                ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]'
                : 'text-[#6F7C7A] hover:text-[#17201F]'
            }`}
            title="Side-by-side live simulator"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dual View</span>
          </button>

          <button
            id="viewmode-customer-btn"
            onClick={() => setViewMode('customer')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'customer'
                ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]'
                : 'text-[#6F7C7A] hover:text-[#17201F]'
            }`}
            title="Customer Mobile View"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Customer</span>
          </button>

          <button
            id="viewmode-staff-btn"
            onClick={() => setViewMode('staff')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'staff'
                ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]'
                : 'text-[#6F7C7A] hover:text-[#17201F]'
            }`}
            title="Staff Dashboard"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Staff</span>
          </button>
        </div>

        {/* Reset Demo Button */}
        <button
          id="reset-demo-btn"
          onClick={onReset}
          className={`${ui.secondaryButton} flex items-center gap-1.5 px-3.5 py-2 text-xs`}
          title="Reset queue to initial demo state"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#0F766E]" />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
};
