import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Scissors, Clock, Phone, User, Check, Play } from 'lucide-react';
import { Salon, Barber } from '../types';

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  salon: Salon;
  barbers: Barber[];
  onAddWalkin: (
    name: string,
    phone: string,
    service: string,
    startImmediately?: boolean,
    selectedBarberIndex?: number
  ) => void;
}

export const WalkInModal: React.FC<WalkInModalProps> = ({
  isOpen,
  onClose,
  salon,
  barbers,
  onAddWalkin,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedService, setSelectedService] = useState(salon.services[0]?.name || 'Haircut');
  const [selectedBarberIndex, setSelectedBarberIndex] = useState<number | undefined>(undefined);
  const [error, setError] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPhone('');
      setSelectedService(salon.services[0]?.name || 'Haircut');
      // Default to first available barber if any
      const firstAvail = barbers.findIndex((b) => b.status === 'available');
      setSelectedBarberIndex(firstAvail >= 0 ? firstAvail : undefined);
      setError('');
      setTimeout(() => nameInputRef.current?.focus(), 150);
    }
  }, [isOpen, salon, barbers]);

  if (!isOpen) return null;

  const availableBarbers = barbers.filter((b) => b.status === 'available');
  const activeServiceObj = salon.services.find((s) => s.name === selectedService) || salon.services[0];

  const handleSubmit = (startImmediately = false) => {
    if (!name.trim()) {
      setError('Please enter the customer name.');
      nameInputRef.current?.focus();
      return;
    }
    setError('');
    onAddWalkin(
      name.trim(),
      phone.trim(),
      selectedService,
      startImmediately,
      selectedBarberIndex
    );
    onClose();
  };

  return (
    <div
      id="walkin-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="walkin-modal-dialog"
        className="relative w-full max-w-md rounded-3xl bg-[#FAF9F6] p-5 sm:p-6 shadow-2xl border border-[#E5E5DF] text-[#1A1A1A] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <button
          id="walkin-modal-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#7A7A70] hover:bg-[#E5E5DF] hover:text-[#1A1A1A] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-[#5A5A40] text-white flex items-center justify-center shadow-xs shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-[#1A1A1A] tracking-tight">
              Add Walk-In Customer
            </h2>
            <p className="text-xs text-[#7A7A70] mt-0.5">
              Enter customer details to place them in queue or seat them directly.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(false);
          }}
          className="space-y-4"
        >
          {/* Customer Name */}
          <div>
            <label
              htmlFor="walkin-popup-name"
              className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-1.5"
            >
              Customer Name <span className="text-rose-600">*</span>
            </label>
            <div className="flex rounded-2xl border border-[#E5E5DF] bg-white focus-within:border-[#5A5A40] focus-within:ring-1 focus-within:ring-[#5A5A40] transition">
              <span className="flex items-center pl-3.5 text-[#7A7A70]">
                <User className="w-4 h-4" />
              </span>
              <input
                ref={nameInputRef}
                id="walkin-popup-name"
                type="text"
                maxLength={60}
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2.5 text-sm bg-transparent outline-none font-medium placeholder:text-[#7A7A70]"
              />
            </div>
            {error && (
              <p id="walkin-name-error" className="text-xs font-semibold text-rose-600 mt-1">
                {error}
              </p>
            )}
          </div>

          {/* Mobile Number */}
          <div>
            <label
              htmlFor="walkin-popup-phone"
              className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-1.5"
            >
              Mobile Number (For Live SMS & Push)
            </label>
            <div className="flex rounded-2xl border border-[#E5E5DF] bg-white focus-within:border-[#5A5A40] focus-within:ring-1 focus-within:ring-[#5A5A40] transition overflow-hidden">
              <span className="flex items-center px-3 text-xs font-bold text-[#5A5A40] bg-[#FAF9F6] border-r border-[#E5E5DF]">
                +91
              </span>
              <input
                id="walkin-popup-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2.5 text-sm bg-transparent outline-none font-medium placeholder:text-[#7A7A70]"
              />
            </div>
          </div>

          {/* Service Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                Select Service
              </label>
              {activeServiceObj && (
                <span className="text-xs font-bold text-[#5A5A40]">
                  ₹{activeServiceObj.priceInr} · {activeServiceObj.durationMin} mins
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {salon.services.map((srv) => {
                const isSelected = selectedService === srv.name;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    id={`walkin-service-pill-${srv.id}`}
                    onClick={() => setSelectedService(srv.name)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                      isSelected
                        ? 'border-[#5A5A40] bg-[#5A5A40]/10 ring-1 ring-[#5A5A40]'
                        : 'border-[#E5E5DF] bg-white hover:border-[#5A5A40]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[#1A1A1A] truncate">{srv.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#7A7A70] mt-1">
                      <span>₹{srv.priceInr}</span>
                      <span>{srv.durationMin}m</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Barber Assignment */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-1.5">
              Assign Barber (Optional)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="barber-select-auto"
                onClick={() => setSelectedBarberIndex(undefined)}
                className={`p-2 rounded-xl border text-xs font-semibold text-center transition cursor-pointer ${
                  selectedBarberIndex === undefined
                    ? 'border-[#5A5A40] bg-[#5A5A40] text-white shadow-xs'
                    : 'border-[#E5E5DF] bg-white text-[#7A7A70] hover:text-[#1A1A1A]'
                }`}
              >
                Auto-Assign
              </button>

              {barbers.map((barber, index) => {
                const isSelected = selectedBarberIndex === index;
                const isAvailable = barber.status === 'available';
                const isBusy = barber.status === 'busy';

                return (
                  <button
                    key={barber.id}
                    type="button"
                    id={`barber-select-${barber.id}`}
                    onClick={() => setSelectedBarberIndex(index)}
                    disabled={barber.status === 'unavailable'}
                    className={`p-2 rounded-xl border text-xs font-semibold text-center transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'border-[#5A5A40] bg-[#5A5A40] text-white shadow-xs'
                        : isBusy
                          ? 'border-[#A66020]/30 bg-[#FAF0E6] text-[#A66020]'
                          : isAvailable
                            ? 'border-[#E5E5DF] bg-white text-[#1A1A1A] hover:border-[#5A5A40]'
                            : 'border-[#E5E5DF] bg-[#FAF9F6] text-[#7A7A70] opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="truncate w-full">{barber.name}</span>
                    <span
                      className={`text-[9px] uppercase font-bold px-1 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : isBusy
                            ? 'text-[#A66020]'
                            : isAvailable
                              ? 'text-[#3D6B37]'
                              : 'text-[#7A7A70]'
                      }`}
                    >
                      {barber.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="submit"
                id="walkin-submit-queue-btn"
                className="py-3 px-4 rounded-2xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white font-bold text-xs shadow-md shadow-[#5A5A40]/15 transition active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add to Queue</span>
              </button>

              <button
                type="button"
                id="walkin-start-now-btn"
                onClick={() => handleSubmit(true)}
                disabled={availableBarbers.length === 0}
                className="py-3 px-4 rounded-2xl bg-[#3D6B37] hover:bg-[#2F532B] disabled:bg-[#7A7A70]/30 disabled:text-[#7A7A70] disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-[#3D6B37]/15 transition active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer"
                title={availableBarbers.length === 0 ? 'No barbers available right now' : 'Directly start service in chair'}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Now</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-semibold text-[#7A7A70] hover:text-[#1A1A1A] transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
