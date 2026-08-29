import type { GymAmenity, GymAmenityIconKey, GymQuickAction, GymQuickActionType } from '../types';

/** The only icon keys any amenity/quick-action can ever reference — kept in
 *  lockstep with the lucide components mapped in gymProfileIcons.tsx so an
 *  owner can never pick an icon the customer surfaces can't render. */
export const GYM_AMENITY_ICON_KEYS: GymAmenityIconKey[] = [
  'Dumbbell', 'HeartPulse', 'Flame', 'Users', 'ShowerHead', 'ParkingCircle',
  'Wifi', 'Wind', 'Music', 'Droplet', 'ShieldCheck', 'Clock', 'Locker', 'Check',
];

const isValidIconKey = (value: unknown): value is GymAmenityIconKey =>
  typeof value === 'string' && (GYM_AMENITY_ICON_KEYS as string[]).includes(value);

/** Best-effort icon for a legacy plain-string amenity (e.g. seeded/admin-
 *  authored data that predates the structured model) — presentation only,
 *  never persisted until the owner actually saves through Manage Profile. */
function guessIconForName(name: string): GymAmenityIconKey {
  const lower = name.toLowerCase();
  if (lower.includes('wi-fi') || lower.includes('wifi')) return 'Wifi';
  if (lower.includes('park')) return 'ParkingCircle';
  if (lower.includes('shower')) return 'ShowerHead';
  if (lower.includes('locker')) return 'Locker';
  if (lower.includes('sauna') || lower.includes('steam')) return 'Flame';
  if (lower.includes('air') || lower.includes('condition') || lower.includes('ac ')) return 'Wind';
  if (lower.includes('music')) return 'Music';
  if (lower.includes('water') || lower.includes('hydrat')) return 'Droplet';
  if (lower.includes('secur') || lower.includes('cctv') || lower.includes('safe')) return 'ShieldCheck';
  if (lower.includes('24') || lower.includes('hour') || lower.includes('open')) return 'Clock';
  if (lower.includes('cardio') || lower.includes('heart')) return 'HeartPulse';
  if (lower.includes('locker room') || lower.includes('changing')) return 'Users';
  if (lower.includes('strength') || lower.includes('weight') || lower.includes('gym')) return 'Dumbbell';
  return 'Check';
}

/** Parses the salon.amenities_json column, which carries either the legacy
 *  plain-string array or (once an owner has saved through Manage Profile)
 *  the structured shape — never a second stored list for either. Always
 *  returns both: `names` for every existing plain-string consumer (Admin
 *  editor, Salon pages, seed data) and `details` for Gym's icon-carrying
 *  surfaces, so nothing else in the app has to change. */
export function normalizeAmenities(raw: unknown): { names: string[]; details: GymAmenity[] } {
  const list = Array.isArray(raw) ? raw : [];
  const details: GymAmenity[] = [];
  const names: string[] = [];
  list.forEach((entry, index) => {
    if (typeof entry === 'string') {
      const name = entry.trim();
      if (!name) return;
      names.push(name);
      details.push({ id: `legacy-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, iconKey: guessIconForName(name), active: true, order: index });
      return;
    }
    if (entry && typeof entry === 'object') {
      const candidate = entry as Partial<GymAmenity>;
      const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
      if (!name) return;
      const active = candidate.active !== false;
      names.push(name);
      details.push({
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `amenity-${index}`,
        name,
        iconKey: isValidIconKey(candidate.iconKey) ? candidate.iconKey : guessIconForName(name),
        active,
        order: typeof candidate.order === 'number' ? candidate.order : index,
      });
    }
  });
  details.sort((a, b) => a.order - b.order);
  return { names: details.filter((d) => d.active).map((d) => d.name), details };
}

/** Validates and sanitizes an owner's amenities save payload before it is
 *  persisted — rejects unknown icon keys rather than silently coercing
 *  them, so a bad client payload never sneaks through into stored data. */
export function sanitizeAmenitiesInput(raw: unknown): GymAmenity[] {
  if (!Array.isArray(raw)) throw new Error('Amenities must be a list.');
  return raw.map((entry, index) => {
    const candidate = (entry || {}) as Partial<GymAmenity>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 60) : '';
    if (!name) throw new Error(`Amenity #${index + 1} needs a name.`);
    if (!isValidIconKey(candidate.iconKey)) throw new Error(`Amenity "${name}" has an unsupported icon.`);
    return {
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id.slice(0, 80) : `amenity-${Date.now()}-${index}`,
      name,
      iconKey: candidate.iconKey,
      active: candidate.active !== false,
      order: index,
    };
  });
}

export const GYM_QUICK_ACTION_TYPES: GymQuickActionType[] = ['schedule', 'directions', 'branches', 'been_here'];

const DEFAULT_QUICK_ACTION_LABELS: Record<GymQuickActionType, { label: string; iconKey: GymAmenityIconKey }> = {
  schedule: { label: 'Schedule', iconKey: 'Clock' },
  directions: { label: 'Directions', iconKey: 'ParkingCircle' },
  branches: { label: 'Branches', iconKey: 'Users' },
  been_here: { label: 'Been here', iconKey: 'ShieldCheck' },
};

/** The trusted built-in Quick Actions row, used whenever an owner hasn't
 *  configured anything yet — every business starts with the same four,
 *  all visible, in the existing order. */
export function defaultQuickActions(): GymQuickAction[] {
  return GYM_QUICK_ACTION_TYPES.map((type, order) => ({
    id: `default-${type}`,
    type,
    label: DEFAULT_QUICK_ACTION_LABELS[type].label,
    iconKey: DEFAULT_QUICK_ACTION_LABELS[type].iconKey,
    visible: true,
    order,
  }));
}

export function normalizeQuickActions(raw: unknown): GymQuickAction[] {
  const list = Array.isArray(raw) ? raw : [];
  if (!list.length) return defaultQuickActions();
  const result: GymQuickAction[] = [];
  list.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const candidate = entry as Partial<GymQuickAction>;
    if (!GYM_QUICK_ACTION_TYPES.includes(candidate.type as GymQuickActionType)) return;
    const type = candidate.type as GymQuickActionType;
    const fallback = DEFAULT_QUICK_ACTION_LABELS[type];
    result.push({
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `action-${type}-${index}`,
      type,
      label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim().slice(0, 40) : fallback.label,
      iconKey: isValidIconKey(candidate.iconKey) ? candidate.iconKey : fallback.iconKey,
      visible: candidate.visible !== false,
      order: typeof candidate.order === 'number' ? candidate.order : index,
    });
  });
  result.sort((a, b) => a.order - b.order);
  return result.length ? result : defaultQuickActions();
}

/** Validates an owner's quick-actions save payload — every action type must
 *  be one of the controlled GYM_QUICK_ACTION_TYPES, so this can never become
 *  a channel for an arbitrary custom URL/action. */
export function sanitizeQuickActionsInput(raw: unknown): GymQuickAction[] {
  if (!Array.isArray(raw)) throw new Error('Quick actions must be a list.');
  return raw.map((entry, index) => {
    const candidate = (entry || {}) as Partial<GymQuickAction>;
    if (!GYM_QUICK_ACTION_TYPES.includes(candidate.type as GymQuickActionType)) {
      throw new Error(`Quick action #${index + 1} has an unsupported type.`);
    }
    const type = candidate.type as GymQuickActionType;
    const fallback = DEFAULT_QUICK_ACTION_LABELS[type];
    if (!isValidIconKey(candidate.iconKey)) throw new Error(`Quick action "${type}" has an unsupported icon.`);
    return {
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id.slice(0, 80) : `action-${type}-${Date.now()}-${index}`,
      type,
      label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim().slice(0, 40) : fallback.label,
      iconKey: candidate.iconKey,
      visible: candidate.visible !== false,
      order: index,
    };
  });
}
