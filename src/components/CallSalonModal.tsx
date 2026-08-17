import React from 'react';
import { X, Phone, Clock, MapPin, Check, PhoneCall } from 'lucide-react';
import { Salon } from '../types';

interface CallSalonModalProps {
  isOpen: boolean;
  onClose: () => void;
  salon: Salon;
}

export const CallSalonModal: React.FC<CallSalonModalProps> = ({
  isOpen,
  onClose,
  salon,
}) => {
  if (!isOpen) return null;

  const salonPhone = '+91 98765 43210';

  return (
    <div
      id="call-salon-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17201F]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="call-salon-modal-dialog"
        className="relative w-full max-w-sm rounded-2xl bg-[#F8FAFA] p-6 shadow-xl border border-[#E1E7E6] text-[#17201F] text-center"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#6F7C7A] hover:bg-[#E1E7E6] hover:text-[#17201F] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-[#0F766E]/10 border border-[#0F766E]/20 flex items-center justify-center text-[#0F766E] mx-auto mb-3.5">
          <PhoneCall className="w-7 h-7" />
        </div>

        <h3 className="font-sans text-xl font-bold text-[#17201F] tracking-tight">
          Contact {salon.name}
        </h3>
        <p className="text-xs text-[#6F7C7A] mt-1 flex items-center justify-center gap-1">
          <MapPin className="w-3 h-3 text-[#0F766E]" />
          <span>{salon.address}</span>
        </p>

        <div className="my-5 p-4 rounded-2xl bg-white border border-[#E1E7E6] space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[#6F7C7A]">
            Direct Reception Line
          </div>
          <div className="font-sans text-lg font-bold text-[#0F766E] font-mono">
            {salonPhone}
          </div>
          <div className="text-[11px] text-[#6F7C7A] flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#0F766E]" />
            <span>Open today: 9:00 AM – 9:00 PM</span>
          </div>
        </div>

        <div className="space-y-2">
          <a
            id="direct-call-tel-link"
            href={`tel:${salonPhone.replace(/\s+/g, '')}`}
            className="w-full py-3.5 px-4 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            <Phone className="w-4 h-4" />
            <span>Call Now ({salonPhone})</span>
          </a>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-[#6F7C7A] hover:text-[#17201F] transition cursor-pointer"
          >
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  );
};
