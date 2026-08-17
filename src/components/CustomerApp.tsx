import React, { useState } from 'react';
import {
  Scissors,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  ArrowLeft,
  Calendar,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  Navigation,
  ShieldCheck,
  Bell,
  BellRing,
  Volume2,
  Check,
  Sparkles,
} from 'lucide-react';
import { Salon, QueueItem, Barber, CustomerScreen } from '../types';
import { SALONS, AVAILABLE_TIME_SLOTS } from '../data/mockData';
import { CallSalonModal } from './CallSalonModal';

interface CustomerAppProps {
  currentScreen: CustomerScreen;
  setScreen: (screen: CustomerScreen) => void;
  selectedSalon: Salon;
  setSelectedSalon: (salon: Salon) => void;
  selectedService: string;
  setSelectedService: (service: string) => void;
  queue: QueueItem[];
  barbers: Barber[];
  userEntry: QueueItem | null;
  onJoinClick: () => void;
  onSelectSlotClick: (slot: string) => void;
  onCancelQueue: () => void;
  permissionStatus: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
  onTestPush: (type: 'approaching' | 'called' | 'reserved_nearing') => void;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({
  currentScreen,
  setScreen,
  selectedSalon,
  setSelectedSalon,
  selectedService,
  setSelectedService,
  queue,
  barbers,
  userEntry,
  onJoinClick,
  onSelectSlotClick,
  onCancelQueue,
  permissionStatus,
  onRequestPermission,
  onTestPush,
}) => {
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  const activeBarbersCount = barbers.filter((b) => b.status !== 'unavailable').length;
  const waitingCustomers = queue.filter((x) => x.status === 'Waiting');
  
  // Calculate ahead count for user or generic
  const peopleAhead = userEntry
    ? queue.filter(
        (x) =>
          x.id !== userEntry.id &&
          ['Waiting', 'Called', 'Serving'].includes(x.status) &&
          x.createdAt < userEntry.createdAt
      ).length
    : waitingCustomers.length;

  const estimatedMinutes = activeBarbersCount > 0
    ? Math.max(5, Math.ceil((peopleAhead * 15) / activeBarbersCount))
    : 0;

  const waitDisplay =
    activeBarbersCount === 0
      ? 'Confirming wait'
      : peopleAhead === 0
        ? 'No wait · Ready now'
        : `${Math.max(5, estimatedMinutes - 5)}–${estimatedMinutes + 5} min`;

  return (
    <div className="flex flex-col h-full bg-[#FAF9F6] text-[#1A1A1A] overflow-y-auto">
      {/* 1. HOME SCREEN - NEARBY SALONS */}
      {currentScreen === 'home' && (
        <div id="customer-home-screen" className="p-5 space-y-4 animate-in fade-in duration-150">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#7A7A70] mb-1">
              Select Salon
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#1A1A1A]">
              Find a salon nearby
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-[#7A7A70] mt-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
              <span>Indiranagar, Bengaluru</span>
            </div>
          </div>

          {userEntry && (
            <div
              id="active-queue-banner"
              onClick={() => setScreen('tracking')}
              className="p-4 rounded-2xl bg-[#5A5A40] text-white flex items-center justify-between shadow-md shadow-[#5A5A40]/15 cursor-pointer hover:bg-[#4A4A34] transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center font-bold text-white text-base">
                  {userEntry.status === 'Called' ? '!' : userEntry.status === 'Serving' ? '✂' : '#'}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-white/70">
                    Active Queue Status
                  </div>
                  <div className="text-sm font-bold text-white">
                    {userEntry.status === 'Called'
                      ? 'Your turn now! Arrive at counter'
                      : userEntry.status === 'Serving'
                        ? 'Currently in grooming service'
                        : `${peopleAhead} ahead · ${waitDisplay}`}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/80" />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A7A70]">
                Popular Near You
              </span>
              <span className="text-[10px] font-bold text-[#3D6B37] bg-[#E8F0E6] px-2 py-0.5 rounded-md uppercase tracking-wider">
                Live Queue Active
              </span>
            </div>

            <div className="space-y-2.5">
              {SALONS.map((salon) => {
                const isSelected = selectedSalon.id === salon.id;
                return (
                  <button
                    key={salon.id}
                    id={`salon-item-${salon.id}`}
                    onClick={() => {
                      setSelectedSalon(salon);
                      setScreen('salon');
                    }}
                    className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[#5A5A40] bg-[#5A5A40]/5 shadow-xs'
                        : 'border-[#E5E5DF] bg-white hover:border-[#5A5A40]/40 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-lg">
                        <Scissors className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <b className="font-serif text-base font-bold text-[#1A1A1A] truncate">
                            {salon.name}
                          </b>
                          {isSelected && (
                            <span className="text-[9px] font-bold bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.5 rounded uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#7A7A70] mt-0.5 truncate">
                          {salon.distanceKm} km · {activeBarbersCount} barbers available
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-[#5A5A40] bg-[#5A5A40]/10 px-2.5 py-1 rounded-lg">
                        {isSelected ? waitDisplay : `${salon.distanceKm * 20 > 30 ? '30-40' : '15-25'} min`}
                      </div>
                      <span className="block text-[10px] text-[#7A7A70] font-medium mt-0.5">
                        Current wait
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. SALON DETAILS & SERVICES */}
      {currentScreen === 'salon' && (
        <div id="customer-salon-screen" className="p-5 space-y-4 animate-in fade-in duration-150">
          <button
            id="back-to-salons-btn"
            onClick={() => setScreen('home')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7A7A70] hover:text-[#1A1A1A] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Nearby salons</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-[#7A7A70]">
                Currently Viewing
              </div>
              <h1 className="font-serif text-2xl font-bold text-[#1A1A1A] tracking-tight">
                {selectedSalon.name}
              </h1>
              <p className="text-xs text-[#7A7A70] mt-0.5">
                {selectedSalon.distanceKm} km away · {activeBarbersCount} barbers available
              </p>
            </div>
            <span className="text-[10px] font-bold text-[#3D6B37] bg-[#E8F0E6] px-2.5 py-1 rounded-full uppercase tracking-wider">
              OPEN
            </span>
          </div>

          {/* Natural Tones Live Wait Card */}
          <div className="bg-[#5A5A40] text-white p-5 rounded-3xl text-center shadow-lg shadow-[#5A5A40]/20">
            <div className="text-[10px] uppercase tracking-widest font-bold text-white/70">
              ESTIMATED WAIT
            </div>
            <div className="font-serif text-3xl sm:text-4xl font-bold py-1 tracking-tight">
              {waitDisplay}
            </div>
            <div className="text-xs text-white/80 italic mt-0.5">
              {peopleAhead === 0
                ? 'No line ahead · Walk right in'
                : `${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} ahead in live queue`}
            </div>
          </div>

          {/* Service Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A7A70]">
                Select Grooming Service
              </span>
              <span className="text-[11px] font-bold text-[#5A5A40]">
                Selected: {selectedService}
              </span>
            </div>

            <div className="space-y-2">
              {selectedSalon.services.map((srv) => {
                const isActive = selectedService === srv.name;
                return (
                  <button
                    key={srv.id}
                    id={`service-opt-${srv.id}`}
                    onClick={() => setSelectedService(srv.name)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'border-2 border-[#5A5A40] bg-[#5A5A40]/10 shadow-xs ring-1 ring-[#5A5A40]'
                        : 'border-[#E5E5DF] bg-white hover:border-[#5A5A40]/40'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isActive ? 'text-[#5A5A40] font-bold' : 'text-[#1A1A1A]'}`}>
                          {srv.name}
                        </span>
                        {isActive && (
                          <span className="text-[9px] font-bold uppercase bg-[#5A5A40] text-white px-1.5 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                      {srv.description && (
                        <div className="text-[11px] text-[#7A7A70] truncate mt-0.5">
                          {srv.description}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block font-serif text-sm italic font-bold text-[#1A1A1A]">
                        ₹{srv.priceInr}
                      </span>
                      <span className="block text-[11px] text-[#7A7A70]">
                        {srv.durationMin} min
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              id="join-live-queue-btn"
              onClick={onJoinClick}
              className="w-full py-4 px-4 rounded-2xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white font-bold text-sm shadow-lg shadow-[#5A5A40]/20 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>{userEntry ? 'View Live Queue Status' : `Join Queue for ${selectedService}`}</span>
            </button>

            <button
              id="reserve-slot-btn"
              onClick={() => setScreen('slots')}
              className="w-full py-2.5 px-4 rounded-xl bg-[#E5E5DF]/50 hover:bg-[#E5E5DF] text-[#1A1A1A] font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>Reserve a future queue window</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. FUTURE TIME SLOTS SCREEN */}
      {currentScreen === 'slots' && (
        <div id="customer-slots-screen" className="p-5 space-y-4 animate-in fade-in duration-150">
          <button
            id="back-to-salon-btn"
            onClick={() => setScreen('salon')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7A7A70] hover:text-[#1A1A1A] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Salon details</span>
          </button>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#7A7A70]">
              Advance Reservation
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#1A1A1A] tracking-tight">
              Reserve your queue time
            </h1>
            <p className="text-xs text-[#7A7A70] mt-1 leading-relaxed">
              This reserves an estimated arrival window in the queue for today with SMS notifications.
            </p>
          </div>

          <div className="p-3.5 bg-white border border-[#E5E5DF] rounded-2xl flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#5A5A40] shrink-0 mt-0.5" />
            <p className="text-xs text-[#1A1A1A] leading-snug">
              Selected service: <b className="font-bold text-[#5A5A40]">{selectedService}</b> at {selectedSalon.name}.
            </p>
          </div>

          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#7A7A70] mb-2.5">
              Available Windows Today
            </span>

            <div className="space-y-2">
              {AVAILABLE_TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  id={`slot-${slot.replace(/\s+/g, '-').toLowerCase()}`}
                  onClick={() => onSelectSlotClick(slot)}
                  className="w-full p-3.5 rounded-2xl border border-[#E5E5DF] bg-white hover:border-[#5A5A40] hover:bg-[#5A5A40]/5 text-left flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF9F6] border border-[#E5E5DF] group-hover:bg-[#5A5A40] group-hover:text-white text-[#5A5A40] flex items-center justify-center font-bold text-xs transition">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <b className="font-serif text-sm font-bold text-[#1A1A1A]">{slot}</b>
                      <span className="block text-[11px] text-[#7A7A70]">
                        Estimated arrival window
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#5A5A40] group-hover:text-[#4A4A34] bg-[#5A5A40]/10 px-3 py-1 rounded-lg">
                    Select Slot
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. LIVE TRACKING SCREEN */}
      {currentScreen === 'tracking' && (
        <div id="customer-tracking-screen" className="p-5 space-y-4 animate-in fade-in duration-150">
          <button
            id="back-to-home-btn"
            onClick={() => setScreen('home')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7A7A70] hover:text-[#1A1A1A] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Find another salon</span>
          </button>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#7A7A70]">
              Live Ticket
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#1A1A1A] tracking-tight">
              Your live queue
            </h1>
            <p className="text-xs text-[#7A7A70] mt-0.5">
              {selectedSalon.name} · {userEntry?.service || selectedService}
            </p>
          </div>

          {/* Main Tracking Card in Natural Tones */}
          <div className="p-6 rounded-3xl bg-white border border-[#E5E5DF] shadow-sm space-y-4">
            <div className="flex items-center gap-4">
              <div
                id="tracking-position-badge"
                className={`w-16 h-16 rounded-2xl flex items-center justify-center font-serif font-bold text-2xl shadow-sm shrink-0 ${
                  userEntry?.status === 'Called'
                    ? 'bg-[#FAF0E6] text-[#A66020] border-2 border-[#A66020] animate-pulse'
                    : userEntry?.status === 'Serving'
                      ? 'bg-[#E8F0E6] text-[#3D6B37] border-2 border-[#3D6B37]'
                      : userEntry?.status === 'Reserved'
                        ? 'bg-[#5A5A40]/10 text-[#5A5A40]'
                        : 'bg-[#5A5A40] text-white'
                }`}
              >
                {userEntry?.status === 'Reserved'
                  ? '✓'
                  : userEntry?.status === 'Called'
                    ? '!'
                    : userEntry?.status === 'Serving'
                      ? '✂'
                      : peopleAhead + 1}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A7A70]">
                  {userEntry?.status === 'Reserved'
                    ? 'RESERVED WINDOW'
                    : userEntry?.status === 'Called'
                      ? 'COUNTER READY'
                      : userEntry?.status === 'Serving'
                        ? 'IN SERVICE'
                        : 'YOUR POSITION'}
                </span>
                <b id="tracking-main-status" className="block font-serif text-xl font-bold text-[#1A1A1A] mt-0.5">
                  {userEntry?.status === 'Reserved'
                    ? `Reserved for ${userEntry.reservedFor}`
                    : userEntry?.status === 'Called'
                      ? 'Please arrive at salon'
                      : userEntry?.status === 'Serving'
                        ? `Chair: ${userEntry.barberName || 'Barber ready'}`
                        : peopleAhead === 0
                          ? 'You are next in line'
                          : `${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} ahead`}
                </b>
              </div>
            </div>

            {/* Notice Box */}
            <div
              id="tracking-notice-box"
              className={`p-3.5 rounded-2xl text-xs font-medium leading-relaxed flex items-start gap-2.5 ${
                userEntry?.status === 'Called'
                  ? 'bg-[#FAF0E6] text-[#A66020] border border-[#A66020]/30'
                  : userEntry?.status === 'Serving'
                    ? 'bg-[#E8F0E6] text-[#3D6B37] border border-[#3D6B37]/30'
                    : userEntry?.status === 'Reserved'
                      ? 'bg-[#FAF9F6] text-[#5A5A40] border border-[#E5E5DF]'
                      : 'bg-[#FAF9F6] text-[#1A1A1A] border border-[#E5E5DF]'
              }`}
            >
              {userEntry?.status === 'Called' ? (
                <AlertCircle className="w-4 h-4 text-[#A66020] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#3D6B37] shrink-0 mt-0.5" />
              )}
              <div>
                {userEntry?.status === 'Called' && (
                  <span>
                    <b>Barber {userEntry.barberName || 'Staff'} is ready!</b> Please step in within 10 minutes.
                  </span>
                )}
                {userEntry?.status === 'Serving' && (
                  <span>
                    Currently in grooming chair with <b>{userEntry.barberName}</b>. Relax and enjoy your cut!
                  </span>
                )}
                {userEntry?.status === 'Reserved' && (
                  <span>
                    Your slot at <b>{userEntry.reservedFor}</b> is held. We will update you with live notifications.
                  </span>
                )}
                {(!userEntry || userEntry.status === 'Waiting') && (
                  <span>
                    {peopleAhead === 0
                      ? 'You are next in line! Head over to the salon entrance now.'
                      : "You're confirmed in live queue. Relax—we'll alert your mobile when it's your turn."}
                  </span>
                )}
              </div>
            </div>

            {/* Queue Details Grid */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#E5E5DF] text-xs">
              <div>
                <span className="text-[#7A7A70] text-[10px] uppercase font-bold tracking-wider block">
                  Estimated Wait
                </span>
                <span className="font-serif font-bold text-[#5A5A40] text-base">
                  {userEntry?.status === 'Called'
                    ? 'Ready Now'
                    : userEntry?.status === 'Serving'
                      ? 'In Progress'
                      : waitDisplay}
                </span>
              </div>
              <div>
                <span className="text-[#7A7A70] text-[10px] uppercase font-bold tracking-wider block">
                  Active Barbers
                </span>
                <span className="font-bold text-[#1A1A1A] text-sm mt-0.5 block">
                  {activeBarbersCount} available
                </span>
              </div>
            </div>
          </div>

          {/* Push Notifications Status & Alert Settings Card */}
          <div
            id="tracking-push-notification-card"
            className="p-4 rounded-2xl bg-white border border-[#E5E5DF] space-y-2.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-[#5A5A40]" />
                <span className="text-xs font-bold text-[#1A1A1A]">Live Push Notifications</span>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  permissionStatus === 'granted'
                    ? 'bg-[#E8F0E6] text-[#3D6B37]'
                    : 'bg-[#5A5A40]/10 text-[#5A5A40]'
                }`}
              >
                {permissionStatus === 'granted' ? 'Alerts Enabled' : 'Simulated Push Active'}
              </span>
            </div>

            <p className="text-[11px] text-[#7A7A70] leading-relaxed">
              {userEntry?.status === 'Reserved'
                ? `Push alert will notify your device 15 minutes before your reserved arrival window (${userEntry.reservedFor}).`
                : 'Push notification will sound and alert your screen when 10–15 minutes remain (1 person ahead) and when your counter is ready.'}
            </p>

            <div className="flex items-center gap-2 pt-1">
              {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
                <button
                  id="tracking-enable-push-btn"
                  onClick={onRequestPermission}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white text-[11px] font-bold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Bell className="w-3 h-3" />
                  <span>Enable Device Notifications</span>
                </button>
              )}

              <button
                id="tracking-test-push-btn"
                onClick={() =>
                  onTestPush(userEntry?.status === 'Reserved' ? 'reserved_nearing' : 'approaching')
                }
                className="py-2 px-3 rounded-xl bg-[#FAF9F6] hover:bg-[#E5E5DF] border border-[#E5E5DF] text-[#5A5A40] text-[11px] font-bold shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer ml-auto"
                title="Test Push Alert"
              >
                <Volume2 className="w-3 h-3" />
                <span>Test Alert</span>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              id="get-directions-link"
              href={`https://maps.google.com/?q=${encodeURIComponent(selectedSalon.name + ' ' + selectedSalon.address)}`}
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-2xl border border-[#E5E5DF] bg-white hover:bg-[#FAF9F6] text-[#1A1A1A] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Navigation className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>Get Directions</span>
            </a>
            <button
              id="call-salon-action-btn"
              onClick={() => setIsCallModalOpen(true)}
              className="p-3 rounded-2xl border border-[#E5E5DF] bg-white hover:bg-[#FAF9F6] text-[#1A1A1A] font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 text-[#7A7A70]" />
              <span>Call Salon</span>
            </button>
          </div>

          {/* Cancel Queue button */}
          <button
            id="cancel-queue-entry-btn"
            onClick={onCancelQueue}
            className="w-full py-2 text-rose-700 hover:text-rose-900 font-semibold text-xs underline underline-offset-4 transition cursor-pointer"
          >
            Cancel my queue entry
          </button>
        </div>
      )}

      {/* Call Salon In-App Modal */}
      <CallSalonModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        salon={selectedSalon}
      />
    </div>
  );
};

