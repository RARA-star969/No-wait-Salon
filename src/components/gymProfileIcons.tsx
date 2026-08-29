import React from 'react';
import {
  Dumbbell, HeartPulse, Flame, Users, ShowerHead, ParkingCircle,
  Wifi, Wind, Music, Droplet, ShieldCheck, Clock, Lock, Check,
  Instagram, Facebook, Youtube, Twitter, Globe,
} from 'lucide-react';
import type { GymAmenityIconKey, SocialPlatform } from '../types';
import { GYM_AMENITY_ICON_KEYS } from '../shared/gymProfileCms';

/** The single place a GymAmenityIconKey becomes an actual icon component —
 *  kept exactly in sync with GYM_AMENITY_ICON_KEYS so every controlled key
 *  always resolves to a real icon, never a silent blank. */
const GYM_ICON_COMPONENTS: Record<GymAmenityIconKey, React.FC<{ className?: string }>> = {
  Dumbbell, HeartPulse, Flame, Users, ShowerHead, ParkingCircle,
  Wifi, Wind, Music, Droplet, ShieldCheck, Clock, Locker: Lock, Check,
};

export function gymProfileIcon(iconKey: GymAmenityIconKey): React.FC<{ className?: string }> {
  return GYM_ICON_COMPONENTS[iconKey] || Check;
}

export const GYM_ICON_LIBRARY: { key: GymAmenityIconKey; icon: React.FC<{ className?: string }> }[] =
  GYM_AMENITY_ICON_KEYS.map((key) => ({ key, icon: GYM_ICON_COMPONENTS[key] }));

const SOCIAL_PLATFORM_ICON_COMPONENTS: Record<SocialPlatform, React.FC<{ className?: string }>> = {
  instagram: Instagram, facebook: Facebook, youtube: Youtube, twitter: Twitter, website: Globe,
};

export function socialPlatformIcon(platform: SocialPlatform): React.FC<{ className?: string }> {
  return SOCIAL_PLATFORM_ICON_COMPONENTS[platform] || Globe;
}
