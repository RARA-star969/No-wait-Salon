import React, { useEffect, useState } from 'react';
import { Camera, UserRound } from 'lucide-react';
import type { CustomerProfile } from '../types';
import { customerAccountService } from '../services/customerAccountService';

/**
 * The one place that resolves a customer's real uploaded photo into an
 * <img>. Shared by the profile screen and the queue-join sheet so the same
 * customer never renders two different identities. Falls back to initials,
 * then a generic person glyph — never a hardcoded identity.
 */
type Props = {
  profile: CustomerProfile | null;
  size?: number;
  editable?: boolean;
  onClick?: () => void;
  className?: string;
};

export const CustomerAvatar: React.FC<Props> = ({ profile, size = 96, editable, onClick, className = '' }) => {
  const [photoSrc, setPhotoSrc] = useState('');
  const initials = profile?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '';

  useEffect(() => {
    let objectUrl = '';
    if (!profile?.profilePhotoUrl) { setPhotoSrc(''); return; }
    customerAccountService.getPhotoObjectUrl().then((url) => { objectUrl = url; setPhotoSrc(url); }).catch(() => setPhotoSrc(''));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [profile?.profilePhotoUrl, profile?.updatedAt]);

  const dimension = `${size}px`;
  const content = photoSrc
    ? <img src={photoSrc} alt="Customer profile" className="h-full w-full object-cover" />
    : initials || <UserRound className="h-1/2 w-1/2" />;

  if (!editable && !onClick) {
    return (
      <span
        aria-label="Profile photo"
        style={{ height: dimension, width: dimension }}
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#DFF0ED] font-bold text-[#0F766E] ring-1 ring-[#C6DEDA] ${className}`}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!editable && !onClick}
      aria-label={editable ? 'Change profile photo' : 'Profile photo'}
      style={{ height: dimension, width: dimension }}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#DFF0ED] font-bold text-[#0F766E] ring-1 ring-[#C6DEDA] disabled:cursor-default ${className}`}
    >
      {content}
      {editable && (
        <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#0F766E] text-white ring-2 ring-white">
          <Camera className="h-4 w-4" />
        </span>
      )}
    </button>
  );
};
