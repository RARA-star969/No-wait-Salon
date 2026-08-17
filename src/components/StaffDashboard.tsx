import React, { useState } from 'react';
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
    action: 'Call' | 'Start' | 'Complete' | 'No-show' | 'Remove',
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
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');

  const waitingCount = queue.filter((x) => x.status === 'Waiting').length;
  const servingCount = queue.filter((x) => x.status === 'Serving').length;
  const calledCount = queue.filter((x) => x.status === 'Called').length;
  const activeBarbers = barbers.filter((b) => b.status !== 'unavailable').length;
  const availableBarbers = barbers.filter((b) => b.status === 'available').length;

  return (
    <div className="flex flex-col h-full bg-[#FAF9F6] text-[#1A1A1A] overflow-y-auto">
      <div className="p-5 space-y-4">
        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-[#E5E5DF] shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#7A7A70]">
              <Users className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>Waiting</span>
            </div>
            <b id="staff-waiting-count" className="block font-serif text-2xl font-bold text-[#1A1A1A] mt-1">
              {waitingCount}
            </b>
            {calledCount > 0 && (
              <span className="text-[10px] font-bold text-[#A66020] block mt-0.5">
                +{calledCount} called
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E5E5DF] shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#7A7A70]">
              <Scissors className="w-3.5 h-3.5 text-[#3D6B37]" />
              <span>In Chair</span>
            </div>
            <b id="staff-serving-count" className="block font-serif text-2xl font-bold text-[#1A1A1A] mt-1">
              {servingCount}
            </b>
            <span className="text-[10px] text-[#7A7A70] block mt-0.5">Serving now</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E5E5DF] shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#7A7A70]">
              <UserCheck className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>Barbers</span>
            </div>
            <b id="staff-barber-count" className="block font-serif text-2xl font-bold text-[#1A1A1A] mt-1 truncate">
              {availableBarbers}/{activeBarbers} <span className="text-xs font-sans font-medium text-[#7A7A70]">free</span>
            </b>
            <span className="text-[10px] text-[#7A7A70] block mt-0.5">Shop capacity</span>
          </div>
        </div>

        {/* Barber Availability Section */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5E5DF] shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
              Barber Availability &amp; Styling Chairs
            </span>
            <span className="text-[11px] text-[#7A7A70]">Click to toggle on/off duty</span>
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
                        ? 'bg-[#E8F0E6] text-[#3D6B37] border-[#3D6B37]/30 hover:bg-[#DDECE0]'
                        : 'bg-[#FAF9F6] text-[#7A7A70] border-[#E5E5DF] hover:bg-[#EAEAE5]'
                  }`}
                  title={isBusy ? `Currently serving: ${barber.currentCustomerName || 'Customer'}` : 'Toggle available/off-duty'}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isBusy ? 'bg-[#A66020] animate-pulse' : isAvailable ? 'bg-[#3D6B37]' : 'bg-[#7A7A70]'
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
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              id="staff-tab-live"
              onClick={() => setActiveTab('live')}
              className={`text-xs font-bold pb-1 border-b-2 transition cursor-pointer ${
                activeTab === 'live'
                  ? 'border-[#5A5A40] text-[#5A5A40]'
                  : 'border-transparent text-[#7A7A70] hover:text-[#1A1A1A]'
              }`}
            >
              Today's Live Queue ({queue.length})
            </button>
            <button
              id="staff-tab-history"
              onClick={() => setActiveTab('history')}
              className={`text-xs font-bold pb-1 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'border-[#5A5A40] text-[#5A5A40]'
                  : 'border-transparent text-[#7A7A70] hover:text-[#1A1A1A]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Completed ({completedList.length})</span>
            </button>
          </div>

          <button
            id="add-walkin-popup-btn"
            onClick={() => setIsWalkinModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white text-xs font-semibold shadow-xs transition active:scale-[0.99] cursor-pointer"
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
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-[#E5E5DF]">
                <Users className="w-8 h-8 text-[#7A7A70] mx-auto mb-2" />
                <p className="text-sm font-bold text-[#1A1A1A]">Queue is currently empty</p>
                <p className="text-xs text-[#7A7A70] mt-0.5 mb-3">
                  Click "+ ADD WALK-IN" or join via Customer App to test live queue flow.
                </p>
                <button
                  onClick={() => setIsWalkinModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
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
                        ? 'bg-[#E8F0E6]/70 border-[#3D6B37]/40 shadow-xs'
                        : isCalled
                          ? 'bg-[#FAF0E6] border-[#A66020]/40 ring-1 ring-[#A66020]/30'
                          : item.isUser
                            ? 'bg-[#5A5A40]/5 border-[#5A5A40]/30'
                            : 'bg-white border-[#E5E5DF]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          isServing
                            ? 'bg-[#3D6B37] text-white'
                            : isCalled
                              ? 'bg-[#A66020] text-white animate-bounce'
                              : item.isUser
                                ? 'bg-[#5A5A40] text-white'
                                : 'bg-[#E5E5DF] text-[#1A1A1A]'
                        }`}
                      >
                        {isServing ? '✂' : isCalled ? '!' : index + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <b className="font-serif text-sm font-bold text-[#1A1A1A] truncate">
                            {item.name}
                          </b>
                          {item.isUser && (
                            <span className="text-[9px] font-bold uppercase bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.5 rounded">
                              App User
                            </span>
                          )}
                          {item.phone && (
                            <span className="text-[10px] text-[#7A7A70] font-mono">
                              · +91 {item.phone.slice(-4)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center flex-wrap gap-2 text-[11px] text-[#7A7A70] mt-0.5">
                          <span className="font-medium text-[#1A1A1A]">{item.service}</span>
                          {isServing && item.barberName && (
                            <span className="font-bold text-[#3D6B37] bg-white px-1.5 py-0.2 rounded border border-[#3D6B37]/30">
                              Barber: {item.barberName}
                            </span>
                          )}
                          {isCalled && item.barberName && (
                            <span className="font-bold text-[#A66020] bg-white px-1.5 py-0.2 rounded border border-[#A66020]/30">
                              Called for: {item.barberName}
                            </span>
                          )}
                          {isReserved && (
                            <span className="font-bold text-[#5A5A40] bg-white px-1.5 py-0.2 rounded border border-[#5A5A40]/30">
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
                            ? 'bg-[#E8F0E6] text-[#3D6B37] border border-[#3D6B37]/30'
                            : isCalled
                              ? 'bg-[#FAF0E6] text-[#A66020] animate-pulse border border-[#A66020]/30'
                              : isReserved
                                ? 'bg-[#5A5A40]/10 text-[#5A5A40]'
                                : 'bg-[#E5E5DF]/60 text-[#7A7A70]'
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
                            className="px-3 py-1.5 rounded-xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                            title="Call customer and assign available barber"
                          >
                            <PhoneForwarded className="w-3 h-3" />
                            <span>Call</span>
                          </button>
                          <button
                            id={`action-start-${item.id}`}
                            onClick={() => onQueueAction(item, 'Start')}
                            className="px-2.5 py-1.5 rounded-xl bg-[#3D6B37] hover:bg-[#2F532B] text-white text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                            title="Start service directly in chair"
                          >
                            <Play className="w-3 h-3" />
                            <span>Start</span>
                          </button>
                          <button
                            id={`action-remove-${item.id}`}
                            onClick={() => onQueueAction(item, 'Remove')}
                            className="p-1.5 rounded-lg text-[#7A7A70] hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                            title="Cancel queue entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {isCalled && (
                        <div className="flex items-center gap-1.5">
                          <button
                            id={`action-start-${item.id}`}
                            onClick={() => onQueueAction(item, 'Start')}
                            className="px-3.5 py-1.5 rounded-xl bg-[#3D6B37] hover:bg-[#2F532B] text-white text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                            title="Seat customer in chair and begin service"
                          >
                            <Play className="w-3 h-3" />
                            <span>Start Service</span>
                          </button>
                          <button
                            id={`action-noshow-${item.id}`}
                            onClick={() => onQueueAction(item, 'No-show')}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200/50 transition cursor-pointer"
                            title="Mark customer as no-show and free barber"
                          >
                            No-show
                          </button>
                        </div>
                      )}

                      {isServing && (
                        <button
                          id={`action-finish-${item.id}`}
                          onClick={() => onQueueAction(item, 'Complete')}
                          className="px-3.5 py-1.5 rounded-xl bg-[#3D6B37] hover:bg-[#2F532B] text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
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
                            className="px-3 py-1.5 rounded-xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
                          >
                            Check In
                          </button>
                          <button
                            id={`action-start-reserved-${item.id}`}
                            onClick={() => onQueueAction(item, 'Start')}
                            className="px-2.5 py-1.5 rounded-xl bg-[#3D6B37] hover:bg-[#2F532B] text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
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

            <p className="text-[11px] text-[#7A7A70] pt-2 leading-relaxed text-center sm:text-left">
              💡 Clicking <b>Start</b> seats the customer in chair, and <b>Finish</b> marks service complete and frees the barber in real-time.
            </p>
          </div>
        )}

        {/* Tab 2: Completed History */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            {completedList.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#E5E5DF]">
                <CheckCircle className="w-8 h-8 text-[#3D6B37] mx-auto mb-2 opacity-60" />
                <p className="text-xs text-[#7A7A70]">No completed services yet today.</p>
                <p className="text-[11px] text-[#7A7A70] mt-1">
                  Start and click "Finish" on any customer in the live queue to record completed cuts here.
                </p>
              </div>
            ) : (
              completedList.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="p-3.5 rounded-2xl bg-white border border-[#E5E5DF] flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="font-serif text-sm font-bold text-[#1A1A1A]">{item.name}</b>
                      {item.isUser && (
                        <span className="text-[9px] font-bold uppercase bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.5 rounded">
                          App User
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#7A7A70] mt-0.5">
                      {item.service} {item.barberName ? `· Served by ${item.barberName}` : ''}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#3D6B37] bg-[#E8F0E6] px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Done</span>
                  </span>
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
