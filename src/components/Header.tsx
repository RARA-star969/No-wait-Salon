import React from 'react';
import { Scissors, RotateCcw, Smartphone, Store, Columns, Bell } from 'lucide-react';
import { ViewMode } from '../types';

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
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E5E5DF]">
      {/* Brand */}
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center shadow-sm shrink-0">
          <Scissors className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-2xl font-bold tracking-tight text-[#1A1A1A]">No-Wait Salon</span>
            <span className="text-[10px] font-bold uppercase tracking-widest bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-md">
              MVP Prototype
            </span>
          </div>
          <p className="text-xs text-[#7A7A70] font-medium mt-0.5">
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
          className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#FAF9F6] text-[#1A1A1A] border border-[#E5E5DF] text-xs font-semibold shadow-xs transition cursor-pointer"
          title="Push Notification Center"
        >
          <Bell className="w-3.5 h-3.5 text-[#5A5A40]" />
          <span className="hidden sm:inline">Alerts</span>
          {notificationCount > 0 && (
            <span
              id="header-notification-badge"
              className="w-5 h-5 rounded-full bg-[#5A5A40] text-white text-[10px] font-bold flex items-center justify-center -mr-1"
            >
              {notificationCount}
            </span>
          )}
          {permissionStatus === 'granted' && notificationCount === 0 && (
            <span className="w-2 h-2 rounded-full bg-[#3D6B37]" title="Push enabled" />
          )}
        </button>

        {/* Mode Selector */}
        <div className="inline-flex rounded-xl bg-[#E5E5DF]/60 p-1 border border-[#E5E5DF]">
          <button
            id="viewmode-split-btn"
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'split'
                ? 'bg-white text-[#1A1A1A] shadow-xs'
                : 'text-[#7A7A70] hover:text-[#1A1A1A]'
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
                ? 'bg-white text-[#1A1A1A] shadow-xs'
                : 'text-[#7A7A70] hover:text-[#1A1A1A]'
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
                ? 'bg-white text-[#1A1A1A] shadow-xs'
                : 'text-[#7A7A70] hover:text-[#1A1A1A]'
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
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF9F6] text-[#5A5A40] border border-[#E5E5DF] text-xs font-semibold shadow-xs transition cursor-pointer active:scale-95"
          title="Reset queue to initial demo state"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#5A5A40]" />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
};
