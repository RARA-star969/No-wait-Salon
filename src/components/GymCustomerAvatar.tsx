import React, { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { initialsFor } from "../shared/gymLiveFloor";
import { gymStaffService } from "../services/gymStaffService";

/**
 * Live Floor avatar. When the visit is linked to a real authenticated
 * customer AND that customer has a photo on their existing NOQ profile, the
 * server hands us a gym-scoped URL for it; we fetch it with the staff session
 * token and render it. Everything else falls back cleanly:
 *
 *   linked + photo   -> the customer's real profile photo
 *   linked, no photo -> their initials
 *   not linked       -> initials from the walk-in name, or a neutral glyph
 *
 * No image bytes are stored on the GymVisit — this only ever resolves
 * customerId -> the one existing profile-photo source. A failed or forbidden
 * fetch degrades to initials rather than showing a broken image.
 */
export const GymCustomerAvatar: React.FC<{
  name?: string;
  photoUrl?: string;
  large?: boolean;
}> = ({ name, photoUrl, large }) => {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    if (!photoUrl) {
      setSrc("");
      return;
    }
    gymStaffService
      .customerPhotoObjectUrl(photoUrl)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => setSrc(""));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrl]);

  const initials = initialsFor(name);
  return (
    <span className={`gym-avatar${large ? " large" : ""}`} aria-hidden={!name}>
      {src ? (
        <img className="gym-avatar-photo" src={src} alt="" />
      ) : initials ? (
        initials
      ) : (
        <UserRound size={large ? 22 : 16} />
      )}
    </span>
  );
};
