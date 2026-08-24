import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  QrCode,
  ListOrdered,
  CalendarDays,
  UserCheck,
  Dumbbell,
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { StaffRole } from '../shared/categoryDashboardResolver';

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
  activeModule,
  onModuleSelect,
}) => {
  // Gym live operational state (capacity 80, inside 42, waiting 3, checkins 96)
  const [occupancy, setOccupancy] = useState(42);
  const maxCapacity = 80;
  const [waitingCount, setWaitingCount] = useState(3);
  const [checkinsCount, setCheckinsCount] = useState(96);
  const [actionFeedback, setActionFeedback] = useState<string>('');

  const [queueList, setQueueList] = useState([
    { id: 'q1', name: 'Rohan Sharma', memberId: 'IH-1082', arrivedAt: '5 mins ago', status: 'Waiting' },
    { id: 'q2', name: 'Priya Patel', memberId: 'IH-1094', arrivedAt: '3 mins ago', status: 'Waiting' },
    { id: 'q3', name: 'Amit Verma', memberId: 'IH-1102', arrivedAt: '1 min ago', status: 'Waiting' },
  ]);

  const [classesList] = useState([
    { id: 'c1', title: 'HIIT Strength & Conditioning', time: '07:00 AM', trainer: 'Coach Vikram', enrolled: 14, maxCapacity: 20 },
    { id: 'c2', title: 'Power Yoga & Mobility', time: '09:00 AM', trainer: 'Coach Ananya', enrolled: 12, maxCapacity: 15 },
    { id: 'c3', title: 'CrossFit Blast', time: '05:30 PM', trainer: 'Coach Rahul', enrolled: 18, maxCapacity: 20 },
    { id: 'c4', title: 'Heavy Lifting Workshop', time: '07:00 PM', trainer: 'Coach Vikram', enrolled: 10, maxCapacity: 12 },
  ]);

  const [trainersList] = useState([
    { id: 't1', name: 'Coach Vikram', role: 'Head Strength Coach', status: 'Available', rating: 4.9, reviewCount: 112 },
    { id: 't2', name: 'Coach Rahul', role: 'HIIT & Functional Specialist', status: 'In Session', rating: 4.8, reviewCount: 89 },
    { id: 't3', name: 'Coach Ananya', role: 'Yoga & Mobility Instructor', status: 'Available', rating: 4.9, reviewCount: 94 },
  ]);

  const [ptBookings] = useState([
    { id: 'pt1', clientName: 'Karan Malhotra', time: '08:00 AM', trainer: 'Coach Vikram', service: 'Personal Training 1-on-1', status: 'Confirmed' },
    { id: 'pt2', clientName: 'Sneha Reddy', time: '10:30 AM', trainer: 'Coach Rahul', service: 'Functional Strength', status: 'Confirmed' },
    { id: 'pt3', clientName: 'Tarun Gupta', time: '04:00 PM', trainer: 'Coach Vikram', service: 'Hypertrophy & Power', status: 'Upcoming' },
  ]);

  const handleCheckIn = () => {
    if (occupancy >= maxCapacity) {
      setActionFeedback('Warning: Gym is currently at maximum capacity!');
      setTimeout(() => setActionFeedback(''), 3000);
      return;
    }
    setOccupancy((prev) => prev + 1);
    setCheckinsCount((prev) => prev + 1);
    if (waitingCount > 0) setWaitingCount((prev) => prev - 1);
    setActionFeedback('Member checked in successfully!');
    setTimeout(() => setActionFeedback(''), 3000);
  };

  const handleCheckOut = () => {
    if (occupancy > 0) setOccupancy((prev) => prev - 1);
    setActionFeedback('Member checked out successfully!');
    setTimeout(() => setActionFeedback(''), 3000);
  };

  const handleAdmitQueueMember = (id: string) => {
    setQueueList((prev) => prev.filter((item) => item.id !== id));
    handleCheckIn();
  };

  const isOwner = role === 'owner';
  const isTrainer = role === 'trainer';
  const occupancyPercent = Math.round((occupancy / maxCapacity) * 100);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#F8FAFA] text-[#17201F]">
      <div className="space-y-5 p-5">
        {/* Header Notification Banner if feedback present */}
        {actionFeedback && (
          <div className="flex items-center justify-between rounded-xl border border-[#0F766E]/30 bg-[#E7F5F2] px-4 py-2.5 text-xs font-semibold text-[#0F766E] shadow-sm">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0F766E]" />
              {actionFeedback}
            </span>
          </div>
        )}

        {/* 1. Overview Screen */}
        {(activeModule === 'overview' || !activeModule) && (
          <div className="space-y-5">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-[#DDE5E3] bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#5C6E6B]">
                  <span>Inside Now</span>
                  <Users className="h-4 w-4 text-[#0F766E]" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#17201F]">
                  {occupancy} <span className="text-xs font-normal text-[#6F7C7A]">/ {maxCapacity}</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#0F766E]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" />
                  {occupancyPercent}% Occupancy
                </div>
              </div>

              <div className="rounded-2xl border border-[#DDE5E3] bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#5C6E6B]">
                  <span>Waiting Outside</span>
                  <Clock className="h-4 w-4 text-[#D97706]" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#17201F]">{waitingCount}</div>
                <div className="mt-1 text-[10px] font-medium text-[#778481]">Peak hour queue</div>
              </div>

              <div className="rounded-2xl border border-[#DDE5E3] bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#5C6E6B]">
                  <span>Check-ins Today</span>
                  <ArrowDownLeft className="h-4 w-4 text-[#0F766E]" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#17201F]">{checkinsCount}</div>
                <div className="mt-1 text-[10px] font-medium text-[#778481]">Total visits today</div>
              </div>

              <div className="rounded-2xl border border-[#DDE5E3] bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#5C6E6B]">
                  <span>Classes Today</span>
                  <CalendarDays className="h-4 w-4 text-[#2563EB]" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#17201F]">6</div>
                <div className="mt-1 text-[10px] font-medium text-[#778481]">4 upcoming</div>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-2xl border border-[#DDE5E3] bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#5C6E6B]">
                  <span>Trainers Ready</span>
                  <UserCheck className="h-4 w-4 text-[#0F766E]" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#17201F]">3</div>
                <div className="mt-1 text-[10px] font-medium text-[#778481]">2 in active PT</div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="rounded-2xl border border-[#DDE5E3] bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C6E6B]">Quick Operational Triggers</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  onClick={handleCheckIn}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-3 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98]"
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  Check In Member
                </button>
                <button
                  onClick={handleCheckOut}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#DDE5E3] bg-[#F4F7F6] px-3 py-2.5 text-xs font-bold text-[#17201F] transition hover:bg-[#E8F0EE] active:scale-[0.98]"
                >
                  <ArrowUpRight className="h-4 w-4 text-[#5C6E6B]" />
                  Check Out Member
                </button>
                <button
                  onClick={() => onModuleSelect('queue')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#DDE5E3] bg-white px-3 py-2.5 text-xs font-bold text-[#17201F] transition hover:bg-[#F4F7F6] active:scale-[0.98]"
                >
                  <ListOrdered className="h-4 w-4 text-[#0F766E]" />
                  View Entry Queue ({queueList.length})
                </button>
                <button
                  onClick={() => onModuleSelect('classes')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#DDE5E3] bg-white px-3 py-2.5 text-xs font-bold text-[#17201F] transition hover:bg-[#F4F7F6] active:scale-[0.98]"
                >
                  <CalendarDays className="h-4 w-4 text-[#2563EB]" />
                  Class Schedule
                </button>
              </div>
            </div>

            {/* Entry Queue & Today's Classes Summary */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Waiting Entry Queue Card */}
              <div className="rounded-2xl border border-[#DDE5E3] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#EAEFEF] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#17201F]">Peak Entry Queue</h3>
                    <p className="text-[11px] text-[#6F7C7A]">Members waiting for gym entry</p>
                  </div>
                  <span className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[10px] font-bold text-[#D97706]">
                    {queueList.length} Waiting
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {queueList.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#EAEFEF] bg-[#F8FAFA] p-3 text-xs">
                      <div>
                        <div className="font-bold text-[#17201F]">{item.name}</div>
                        <div className="text-[10px] text-[#778481]">{item.memberId} · Arrived {item.arrivedAt}</div>
                      </div>
                      <button
                        onClick={() => handleAdmitQueueMember(item.id)}
                        className="rounded-lg bg-[#0F766E] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition active:scale-95"
                      >
                        Admit
                      </button>
                    </div>
                  ))}
                  {queueList.length === 0 && (
                    <div className="py-6 text-center text-xs text-[#778481]">No members waiting in entry queue.</div>
                  )}
                </div>
              </div>

              {/* Classes Schedule Summary */}
              <div className="rounded-2xl border border-[#DDE5E3] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#EAEFEF] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#17201F]">Today's Scheduled Classes</h3>
                    <p className="text-[11px] text-[#6F7C7A]">Group training sessions</p>
                  </div>
                  <button
                    onClick={() => onModuleSelect('classes')}
                    className="text-[11px] font-bold text-[#0F766E] hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {classesList.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#EAEFEF] bg-[#F8FAFA] p-3 text-xs">
                      <div>
                        <div className="font-bold text-[#17201F]">{item.title}</div>
                        <div className="text-[10px] text-[#778481]">{item.time} · {item.trainer}</div>
                      </div>
                      <span className="rounded-md bg-[#E8F0EE] px-2 py-1 text-[10px] font-bold text-[#0F766E]">
                        {item.enrolled}/{item.maxCapacity} Enrolled
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Live Capacity Screen */}
        {activeModule === 'capacity' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#DDE5E3] bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-[#17201F]">Live Gym Capacity Meter</h3>
              <p className="text-xs text-[#6F7C7A]">Real-time occupancy tracking for floor, cardio, and sauna zones.</p>

              <div className="mt-5 rounded-2xl bg-[#F4F7F6] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5C6E6B]">Current Occupancy Rate</span>
                  <span className="text-sm font-extrabold text-[#0F766E]">{occupancy} / {maxCapacity} ({occupancyPercent}%)</span>
                </div>
                <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-[#DDE5E3]">
                  <div
                    className={`h-full transition-all duration-500 ${
                      occupancyPercent > 90 ? 'bg-[#DC2626]' : occupancyPercent > 75 ? 'bg-[#D97706]' : 'bg-[#0F766E]'
                    }`}
                    style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#EAEFEF] bg-[#F8FAFA] p-4 text-xs">
                  <div className="font-bold text-[#17201F]">Free Weight & Heavy Racks</div>
                  <div className="mt-1 text-[11px] text-[#6F7C7A]">24 / 30 Active (80% Zone Load)</div>
                </div>
                <div className="rounded-xl border border-[#EAEFEF] bg-[#F8FAFA] p-4 text-xs">
                  <div className="font-bold text-[#17201F]">Cardio & HIIT Deck</div>
                  <div className="mt-1 text-[11px] text-[#6F7C7A]">12 / 25 Active (48% Zone Load)</div>
                </div>
                <div className="rounded-xl border border-[#EAEFEF] bg-[#F8FAFA] p-4 text-xs">
                  <div className="font-bold text-[#17201F]">Sauna & Recovery Spa</div>
                  <div className="mt-1 text-[11px] text-[#6F7C7A]">6 / 15 Active (40% Zone Load)</div>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={handleCheckIn}
                  className="rounded-xl bg-[#0F766E] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
                >
                  + Manual Check In
                </button>
                <button
                  onClick={handleCheckOut}
                  className="rounded-xl border border-[#DDE5E3] bg-white px-4 py-2.5 text-xs font-bold text-[#17201F] transition hover:bg-[#F4F7F6] active:scale-95"
                >
                  - Manual Check Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Check-in / Check-out Screen */}
        {activeModule === 'checkin' && (
          <div className="rounded-2xl border border-[#DDE5E3] bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-[#17201F]">Member Check-in & Out Terminal</h3>
            <p className="text-xs text-[#6F7C7A]">Scan member QR pass or look up by member ID.</p>

            <div className="mt-5 max-w-md space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#5C6E6B]">Member ID / Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. IH-1082 or 9876543210"
                  className="mt-1 w-full rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-3.5 py-2 text-xs text-[#17201F] focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCheckIn}
                  className="flex-1 rounded-xl bg-[#0F766E] py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
                >
                  Check In
                </button>
                <button
                  onClick={handleCheckOut}
                  className="flex-1 rounded-xl border border-[#DDE5E3] bg-[#F4F7F6] py-2.5 text-xs font-bold text-[#17201F] transition hover:bg-[#E8F0EE] active:scale-95"
                >
                  Check Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Entry Queue Screen */}
        {activeModule === 'queue' && (
          <div className="rounded-2xl border border-[#DDE5E3] bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-[#17201F]">Entry Waiting Queue</h3>
            <p className="text-xs text-[#6F7C7A]">Manage peak-hour arrivals waiting outside.</p>

            <div className="mt-4 space-y-2">
              {queueList.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#EAEFEF] bg-[#F8FAFA] p-3 text-xs">
                  <div>
                    <div className="font-bold text-[#17201F]">{item.name}</div>
                    <div className="text-[10px] text-[#778481]">{item.memberId} · Arrived {item.arrivedAt}</div>
                  </div>
                  <button
                    onClick={() => handleAdmitQueueMember(item.id)}
                    className="rounded-lg bg-[#0F766E] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition active:scale-95"
                  >
                    Admit Member
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Classes Screen */}
        {activeModule === 'classes' && (
          <div className="rounded-2xl border border-[#DDE5E3] bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-[#17201F]">Group Classes & Workshops</h3>
            <p className="text-xs text-[#6F7C7A]">Today's scheduled workout sessions.</p>

            <div className="mt-4 space-y-3">
              {classesList.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-[#EAEFEF] bg-[#F8FAFA] p-4 text-xs">
                  <div>
                    <div className="text-sm font-bold text-[#17201F]">{c.title}</div>
                    <div className="text-[11px] text-[#6F7C7A]">{c.time} · {c.trainer}</div>
                  </div>
                  <span className="rounded-lg bg-[#E7F5F2] px-3 py-1 text-[11px] font-bold text-[#0F766E]">
                    {c.enrolled} / {c.maxCapacity} Enrolled
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Trainers Screen */}
        {activeModule === 'trainers' && (
          <div className="rounded-2xl border border-[#DDE5E3] bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-[#17201F]">Trainers & Coaches Roster</h3>
            <p className="text-xs text-[#6F7C7A]">Certified fitness staff assigned to Iron House Gym.</p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {trainersList.map((t) => (
                <div key={t.id} className="rounded-xl border border-[#EAEFEF] bg-[#F8FAFA] p-4 text-xs">
                  <div className="font-bold text-[#17201F]">{t.name}</div>
                  <div className="text-[11px] text-[#0F766E]">{t.role}</div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-[#778481]">
                    <span>★ {t.rating} ({t.reviewCount} reviews)</span>
                    <span className="rounded bg-[#E8F0EE] px-1.5 py-0.5 font-bold text-[#0F766E]">{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. PT Bookings Screen */}
        {activeModule === 'pt_bookings' && (
          <div className="rounded-2xl border border-[#DDE5E3] bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-[#17201F]">Personal Training 1-on-1 Bookings</h3>
            <p className="text-xs text-[#6F7C7A]">Scheduled private coaching sessions.</p>

            <div className="mt-4 space-y-2">
              {ptBookings.map((pt) => (
                <div key={pt.id} className="flex items-center justify-between rounded-xl border border-[#EAEFEF] bg-[#F8FAFA] p-3 text-xs">
                  <div>
                    <div className="font-bold text-[#17201F]">{pt.clientName}</div>
                    <div className="text-[10px] text-[#778481]">{pt.service} · {pt.time} · {pt.trainer}</div>
                  </div>
                  <span className="rounded bg-[#E8F0EE] px-2 py-0.5 text-[10px] font-bold text-[#0F766E]">
                    {pt.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. Gym Settings Screen (Owner Only) */}
        {activeModule === 'settings' && (
          <div className="rounded-2xl border border-[#DDE5E3] bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-[#17201F]">Gym Facility & Capacity Settings</h3>
            <p className="text-xs text-[#6F7C7A]">Configure max capacity, operating hours and gym rules.</p>

            {!isOwner && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#FEF2F2] p-3 text-xs font-semibold text-[#DC2626]">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Access Restricted: Only Gym Owners can modify facility settings.
              </div>
            )}

            {isOwner && (
              <div className="mt-4 max-w-md space-y-4 text-xs">
                <div>
                  <label className="font-bold text-[#5C6E6B]">Maximum Facility Capacity</label>
                  <input
                    type="number"
                    defaultValue={80}
                    className="mt-1 w-full rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-3.5 py-2 text-xs text-[#17201F]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#5C6E6B]">Operating Hours</label>
                  <input
                    type="text"
                    defaultValue="Mon–Sun · 6:00 AM–10:00 PM"
                    className="mt-1 w-full rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-3.5 py-2 text-xs text-[#17201F]"
                  />
                </div>
                <button
                  onClick={() => {
                    setActionFeedback('Gym settings updated!');
                    setTimeout(() => setActionFeedback(''), 3000);
                  }}
                  className="rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-bold text-white shadow-sm"
                >
                  Save Settings
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
