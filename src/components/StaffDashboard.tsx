import React, { useEffect, useState } from 'react';
import { callPhase, formatCountdown, remainingMs } from '../shared/queueTiming';
import {
  Users,
  UserCheck,
  Scissors,
  Plus,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Check,
  UserPlus,
  Sparkles,
  History,
  Trash2,
  PhoneForwarded,
} from 'lucide-react';
import { QueueItem, Barber, Salon } from '../types';
import { WalkInModal } from './WalkInModal';
import { ui } from './ui';

interface StaffDashboardProps {
  salon: Salon;
  queue: QueueItem[];
  barbers: Barber[];
  completedList: QueueItem[];
  onBarberToggle: (barberIndex: number) => void;
  onAddWalkin: (
    name: string,
    phone: string,
    service: string,
    startImmediately?: boolean,
    selectedBarberIndex?: number
  ) => void;
  onQueueAction: (
    item: QueueItem,
    action: 'Call' | 'Acknowledge' | 'Start' | 'Complete' | 'No-show' | 'Remove',
    specificBarberIndex?: number
  ) => void;
  queueAlert: string;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  salon,
  queue,
  barbers,
  completedList,
  onBarberToggle,
  onAddWalkin,
  onQueueAction,
  queueAlert,
}) => {
  // Single ticking clock so every CALLED countdown re-renders each second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');

  const waitingCount = queue.filter((x) => x.status === 'Waiting').length;
  const servingCount = queue.filter((x) => x.status === 'Serving').length;
  const calledCount = queue.filter((x) => x.status === 'Called').length;
  const activeBarbers = barbers.filter((b) => b.status !== 'unavailable').length;
  const availableBarbers = barbers.filter((b) => b.status === 'available').length;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#F8FAFA] text-[#17201F]">
      <div className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={ui.eyebrow}>Today at the salon</span>
            <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#17201F]">{salon.name}</h2>
            <p className="mt-0.5 text-[11px] text-[#6F7C7A]">Manage chairs, arrivals and the live queue in one place.</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#E7F5F2] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" />
            Open
          </span>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`${ui.card} p-3.5`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#6F7C7A]">
              <Users className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Waiting</span>
            </div>
            <b id="staff-waiting-count" className="block font-sans text-2xl font-bold text-[#17201F] mt-1">
              {waitingCount}
            </b>
            {calledCount > 0 && (
              <span className="text-[10px] font-bold text-[#A66020] block mt-0.5">
                +{calledCount} called
              </span>
            )}
          </div>

          <div className={`${ui.card} p-3.5`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#6F7C7A]">
              <Scissors className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>In Chair</span>
            </div>
            <b id="staff-serving-count" className="block font-sans text-2xl font-bold text-[#17201F] mt-1">
              {servingCount}
            </b>
            <span className="text-[10px] text-[#6F7C7A] block mt-0.5">Serving now</span>
          </div>

          <div className={`${ui.card} p-3.5`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#6F7C7A]">
              <UserCheck className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Barbers</span>
            </div>
            <b id="staff-barber-count" className="block font-sans text-2xl font-bold text-[#17201F] mt-1 truncate">
              {availableBarbers}/{activeBarbers} <span className="text-xs font-sans font-medium text-[#6F7C7A]">free</span>
            </b>
            <span className="text-[10px] text-[#6F7C7A] block mt-0.5">Shop capacity</span>
          </div>
        </div>

        {/* Barber Availability Section */}
        <div className={`${ui.card} p-4`}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <span className="block text-xs font-bold text-[#17201F]">Team &amp; chairs</span>
              <span className="mt-0.5 block text-[10px] text-[#6F7C7A]">Tap an available barber to change duty status</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {barbers.map((barber, index) => {
              const isBusy = barber.status === 'busy';
              const isAvailable = barber.status === 'available';

              return (
                <button
                  key={barber.id}
                  id={`barber-btn-${barber.id}`}
                  onClick={() => onBarberToggle(index)}
                  disabled={isBusy}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition cursor-pointer ${
                    isBusy
                      ? 'bg-[#FAF0E6] text-[#A66020] border-[#A66020]/30 cursor-not-allowed opacity-90'
                      : isAvailable
                        ? 'bg-[#E7F5F2] text-[#0F766E] border-[#0F766E]/30 hover:bg-[#DDECE0]'
                        : 'bg-[#F8FAFA] text-[#6F7C7A] border-[#E1E7E6] hover:bg-[#EAEAE5]'
                  }`}
                  title={isBusy ? `Currently serving: ${barber.currentCustomerName || 'Customer'}` : 'Toggle available/off-duty'}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isBusy ? 'bg-[#A66020] animate-pulse' : isAvailable ? 'bg-[#0F766E]' : 'bg-[#6F7C7A]'
                    }`}
                  />
                  <span>{barber.name}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/70">
                    {isBusy ? 'In Chair' : isAvailable ? 'Available' : 'Off-duty'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Queue Header & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E7E6] pb-3 pt-1">
          <div className="inline-flex rounded-xl border border-[#E1E7E6] bg-[#EEF3F2] p-1">
            <button
              id="staff-tab-live"
              onClick={() => setActiveTab('live')}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'live'
                  ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]'
                  : 'text-[#6F7C7A] hover:text-[#17201F]'
              }`}
            >
              Today's Live Queue ({queue.length})
            </button>
            <button
              id="staff-tab-history"
              onClick={() => setActiveTab('history')}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'history'
                  ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]'
                  : 'text-[#6F7C7A] hover:text-[#17201F]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Completed ({completedList.length})</span>
            </button>
          </div>

          <button
            id="add-walkin-popup-btn"
            onClick={() => setIsWalkinModalOpen(true)}
            className={`${ui.primaryButton} flex items-center gap-1.5 px-3 py-2 text-xs`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ ADD WALK-IN</span>
          </button>
        </div>

        {/* Alert message */}
        {queueAlert && (
          <div
            id="staff-queue-alert"
            className="p-3 bg-[#FAF0E6] border border-[#A66020]/40 rounded-2xl text-xs font-semibold text-[#A66020] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-[#A66020] shrink-0" />
            <span>{queueAlert}</span>
          </div>
        )}

        {/* Tab 1: Live Queue Entries */}
        {activeTab === 'live' && (
          <div className="space-y-2.5">
            {queue.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-[#E1E7E6]">
                <Users className="w-8 h-8 text-[#6F7C7A] mx-auto mb-2" />
                <p className="text-sm font-bold text-[#17201F]">Queue is currently empty</p>
                <p className="text-xs text-[#6F7C7A] mt-0.5 mb-3">
                  Click "+ ADD WALK-IN" or join via Customer App to test live queue flow.
                </p>
                <button
                  onClick={() => setIsWalkinModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-xs font-semibold transition cursor-pointer"
                >
                  + Add Walk-In Customer
                </button>
              </div>
            ) : (
              queue.map((item, index) => {
                const isServing = item.status === 'Serving';
                const isCalled = item.status === 'Called';
                const isWaiting = item.status === 'Waiting';
                const isReserved = item.status === 'Reserved';

                return (
                  <div
                    key={item.id}
                    id={`queue-entry-${item.id}`}
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      isServing
                        ? 'bg-[#E7F5F2]/70 border-[#0F766E]/40'
                        : isCalled
                          ? 'bg-[#FAF0E6] border-[#A66020]/40 ring-1 ring-[#A66020]/30'
                          : item.isUser
                            ? 'bg-[#0F766E]/5 border-[#0F766E]/30'
                            : 'bg-white border-[#E1E7E6]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          isServing
                            ? 'bg-[#0F766E] text-white'
                            : isCalled
                              ? 'bg-[#A66020] text-white'
                              : item.isUser
                                ? 'bg-[#0F766E] text-white'
                                : 'bg-[#E1E7E6] text-[#17201F]'
                        }`}
                      >
                        {isServing ? '✂' : isCalled ? '!' : index + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <b className="font-sans text-sm font-bold text-[#17201F] truncate">
                            {item.name}
                          </b>
                          {item.isUser && (
                            <span className="text-[9px] font-bold uppercase bg-[#0F766E]/10 text-[#0F766E] px-1.5 py-0.5 rounded">
                              {item.source === 'qr_web' ? 'Web QR' : item.source === 'qr_walk_in' ? 'QR Walk-in' : 'App User'}{(item.callAttempt || 0) > 1 ? ` · Call ${item.callAttempt}` : ''}
                            </span>
                          )}
                          {item.phone && (
                            <span className="text-[10px] text-[#6F7C7A] font-mono">
                              · +91 {item.phone.slice(-4)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center flex-wrap gap-2 text-[11px] text-[#6F7C7A] mt-0.5">
                          <span className="font-medium text-[#17201F]">{item.service}</span>
                          {isServing && item.barberName && (
                            <span className="font-bold text-[#0F766E] bg-white px-1.5 py-0.2 rounded border border-[#0F766E]/30">
                              Barber: {item.barberName}
                            </span>
                          )}
                          {isCalled && item.barberName && (
                            <span className="font-bold text-[#A66020] bg-white px-1.5 py-0.2 rounded border border-[#A66020]/30">
                              Called for: {item.barberName}
                            </span>
                          )}
                          {isReserved && (
                            <span className="font-bold text-[#0F766E] bg-white px-1.5 py-0.2 rounded border border-[#0F766E]/30">
                              Reserved: {item.reservedFor}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                          isServing
                            ? 'bg-[#E7F5F2] text-[#0F766E] border border-[#0F766E]/30'
                            : isCalled
                              ? 'bg-[#FAF0E6] text-[#A66020] animate-pulse border border-[#A66020]/30'
                              : isReserved
                                ? 'bg-[#0F766E]/10 text-[#0F766E]'
                                : 'bg-[#E1E7E6]/60 text-[#6F7C7A]'
                        }`}
                      >
                        {item.status}
                      </span>

                      {/* Action buttons based on status */}
                      {isWaiting && (
                        <div className="flex items-center gap-1.5">
                          <button
                            id={`action-call-${item.id}`}
                            onClick={() => onQueueAction(item, 'Call')}
                            className="px-3 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-xs font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1"
                            title="Call customer and assign available barber"
                          >
                            <PhoneForwarded className="w-3 h-3" />
                            <span>Call</span>
                          </button>
                          <button
                            id={`action-start-${item.id}`}
                            onClick={() => onQueueAction(item, 'Start')}
                            className="px-2.5 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-xs font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1"
                            title="Start service directly in chair"
                          >
                            <Play className="w-3 h-3" />
                            <span>Start</span>
                          </button>
                          <button
                            id={`action-remove-${item.id}`}
                            onClick={() => onQueueAction(item, 'Remove')}
                            className="p-1.5 rounded-lg text-[#6F7C7A] hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                            title="Cancel queue entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {isCalled && (() => {
                        // Inside the arrival window staff only see the countdown
                        // and Start Service. No-show and Call Again unlock once
                        // the server deadline has passed.
                        const windowOpen = callPhase(item, now) === 'called';
                        return (
                          <div className="flex items-center gap-1.5">
                            {windowOpen ? (
                              <span
                                id={`arrival-countdown-${item.id}`}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-800 text-xs font-bold tabular-nums"
                                title="Arrival window remaining"
                              >
                                {formatCountdown(remainingMs(item, now))} remaining
                              </span>
                            ) : (
                              <button
                                id={`action-callagain-${item.id}`}
                                onClick={() => onQueueAction(item, 'Call')}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
                                title="Call this customer again and restart the arrival window"
                              >
                                Call Again
                              </button>
                            )}
                            <button
                              id={`action-start-${item.id}`}
                              onClick={() => onQueueAction(item, 'Start')}
                              className="px-3.5 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-xs font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1"
                              title="Seat customer in chair and begin service"
                            >
                              <Play className="w-3 h-3" />
                              <span>Start Service</span>
                            </button>
                            {!windowOpen && (
                              <button
                                id={`action-noshow-${item.id}`}
                                onClick={() => onQueueAction(item, 'No-show')}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200/50 transition cursor-pointer"
                                title="Mark customer as no-show and free barber"
                              >
                                No-show
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {isServing && (
                        <button
                          id={`action-finish-${item.id}`}
                          onClick={() => onQueueAction(item, 'Complete')}
                          className="px-3.5 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                          title="Finish haircut and free styling chair"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Finish / Complete</span>
                        </button>
                      )}

                      {isReserved && (
                        <div className="flex items-center gap-1.5">
                          <button
                            id={`action-call-reserved-${item.id}`}
                            onClick={() => onQueueAction(item, 'Call')}
                            className="px-3 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
                          >
                            Check In
                          </button>
                          <button
                            id={`action-start-reserved-${item.id}`}
                            onClick={() => onQueueAction(item, 'Start')}
                            className="px-2.5 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
                          >
                            Start
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <p className="text-[11px] text-[#6F7C7A] pt-2 leading-relaxed text-center sm:text-left">
              💡 Clicking <b>Start</b> seats the customer in chair, and <b>Finish</b> marks service complete and frees the barber in real-time.
            </p>
          </div>
        )}

        {/* Tab 2: Completed History */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            {completedList.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#E1E7E6]">
                <CheckCircle className="w-8 h-8 text-[#0F766E] mx-auto mb-2 opacity-60" />
                <p className="text-xs text-[#6F7C7A]">No completed services yet today.</p>
                <p className="text-[11px] text-[#6F7C7A] mt-1">
                  Start and click "Finish" on any customer in the live queue to record completed cuts here.
                </p>
              </div>
            ) : (
              completedList.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="p-3.5 rounded-2xl bg-white border border-[#E1E7E6] flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="font-sans text-sm font-bold text-[#17201F]">{item.name}</b>
                      {item.isUser && (
                        <span className="text-[9px] font-bold uppercase bg-[#0F766E]/10 text-[#0F766E] px-1.5 py-0.5 rounded">
                          {item.source === 'qr_web' ? 'Web QR' : item.source === 'qr_walk_in' ? 'QR Walk-in' : 'App User'}{(item.callAttempt || 0) > 1 ? ` · Call ${item.callAttempt}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#6F7C7A] mt-0.5">
                      {item.service} {item.barberName ? `· Served by ${item.barberName}` : ''}
                    </div>
                  </div>
                  {item.outcome === 'no_show' || item.status === 'NoShow' ? (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/60 px-2.5 py-1 rounded-full">
                      NO SHOW
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-[#0F766E] bg-[#E7F5F2] px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Done</span>
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Dedicated Walk-in Popup Modal */}
      <WalkInModal
        isOpen={isWalkinModalOpen}
        onClose={() => setIsWalkinModalOpen(false)}
        salon={salon}
        barbers={barbers}
        onAddWalkin={onAddWalkin}
      />
    </div>
  );
};
