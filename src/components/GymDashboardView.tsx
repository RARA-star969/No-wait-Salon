import React, { useState, useEffect } from 'react';
import { StaffRole } from '../shared/categoryDashboardResolver';
import { gymStaffService } from '../services/gymStaffService';
import { Minus, Plus, Users, ShieldAlert, Activity } from 'lucide-react';

interface GymDashboardViewProps {
  gymId: string;
  gymName: string;
  role: StaffRole;
  staffName: string;
  activeModule: string;
  onModuleSelect: (moduleId: string) => void;
}

export const GymDashboardView: React.FC<GymDashboardViewProps> = ({
  gymId,
  gymName,
  role,
  staffName,
}) => {
  const [state, setState] = useState<any>(null);
  const [actionFeedback, setActionFeedback] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchState = async () => {
      try {
        const data = await gymStaffService.getOverview(gymId);
        if (active) {
          setState(data);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [gymId]);

  if (loading || !state) {
    return <div className="p-8 text-center text-[#5C6E6B]">Loading gym dashboard...</div>;
  }

  const occupancy = state.currentOccupancy;
  const maxCapacity = state.maxCapacity;
  const availableTrainersCount = state.availableTrainersCount !== undefined ? state.availableTrainersCount : (state.trainers || []).filter((t: any) => t.status === 'Available').length;

  const updateCoreState = async (updates: { currentOccupancy?: number, maxCapacity?: number, availableTrainersCount?: number }) => {
    try {
      const res = await gymStaffService.updateCoreState(gymId, updates);
      setState(res.state);
      setActionFeedback('Updated successfully!');
      setTimeout(() => setActionFeedback(''), 3000);
    } catch (err: any) {
      setActionFeedback(err.message || 'Update failed');
      setTimeout(() => setActionFeedback(''), 3000);
    }
  };

  const isOwner = role === 'owner';

  if (!isOwner) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-[#E1E7E6] bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="h-8 w-8 text-[#DC2626]" />
        <h3 className="mt-3 text-lg font-bold text-[#17201F]">Owner Access Required</h3>
        <p className="mt-2 text-sm text-[#5C6E6B]">Only Gym Owners can view and modify these core operational settings.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17201F]">Gym Operations</h1>
          <p className="mt-1 text-sm text-[#5C6E6B]">Live control panel for {gymName}</p>
        </div>
        {actionFeedback && (
          <span className="rounded-full bg-[#E7F5F2] px-3 py-1 text-[11px] font-bold text-[#0F766E] shadow-sm animate-pulse">
            {actionFeedback}
          </span>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Control 1: INSIDE NOW */}
        <div className="rounded-2xl border border-[#DDE5E3] bg-white p-6 shadow-sm flex flex-col items-center justify-center">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#5C6E6B] mb-2">Inside Now</div>
          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={() => updateCoreState({ currentOccupancy: Math.max(0, occupancy - 1) })}
              className="grid h-10 w-10 place-items-center rounded-full bg-[#F4F7F6] text-[#17201F] hover:bg-[#EAEFEF] active:scale-95"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="text-4xl font-extrabold text-[#17201F] min-w-[3rem] text-center">{occupancy}</span>
            <button 
              onClick={() => updateCoreState({ currentOccupancy: Math.min(maxCapacity, occupancy + 1) })}
              className="grid h-10 w-10 place-items-center rounded-full bg-[#0F766E] text-white hover:bg-[#0D5E5E] active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Control 2: MAX CAPACITY */}
        <div className="rounded-2xl border border-[#DDE5E3] bg-white p-6 shadow-sm flex flex-col items-center justify-center">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#5C6E6B] mb-2">Max Capacity</div>
          <input 
            type="number"
            min="1"
            value={maxCapacity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1) updateCoreState({ maxCapacity: val });
            }}
            className="text-4xl font-extrabold text-[#17201F] text-center w-32 border-b-2 border-transparent focus:border-[#0F766E] outline-none"
          />
        </div>

        {/* Control 3: AVAILABLE TRAINERS */}
        <div className="rounded-2xl border border-[#DDE5E3] bg-white p-6 shadow-sm flex flex-col items-center justify-center">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#5C6E6B] mb-2">Available Trainers</div>
          <input 
            type="number"
            min="0"
            value={availableTrainersCount}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 0) updateCoreState({ availableTrainersCount: val });
            }}
            className="text-4xl font-extrabold text-[#17201F] text-center w-32 border-b-2 border-transparent focus:border-[#0F766E] outline-none"
          />
        </div>
      </div>
    </div>
  );
};
