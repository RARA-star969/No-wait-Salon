export type MainCategoryType = 'salon' | 'gym' | 'moto' | 'pets' | string;
export type StaffRole = 'owner' | 'manager' | 'staff' | 'trainer' | 'reception';

export interface CategoryModuleConfig {
  id: string;
  label: string;
  icon: string;
  allowedRoles: StaffRole[];
  requiredCapability?: string;
}

export interface StaffAuthSession {
  token: string;
  staff: {
    id: string;
    email: string;
    name: string;
    role: StaffRole;
  };
  business: {
    id: string;
    name: string;
    mainCategoryId: MainCategoryType;
    categoryLabel?: string;
  };
  allowedCapabilities: string[];
}

export function resolveCategoryCapabilities(mainCategoryId: MainCategoryType, role: StaffRole): string[] {
  const cat = (mainCategoryId || 'salon').toLowerCase();
  const isOwnerOrManager = role === 'owner' || role === 'manager';

  if (cat === 'gym') {
    if (role === 'trainer') {
      return ['my_classes', 'my_pt_bookings', 'trainer_availability'];
    }
    if (role === 'reception') {
      return ['capacity_view', 'check_in_out', 'entry_queue', 'pt_bookings'];
    }
    if (isOwnerOrManager) {
      return [
        'capacity_view',
        'check_in_out',
        'entry_queue',
        'classes_manage',
        'trainers_manage',
        'pt_bookings',
        'gym_settings',
        'members_manage',
        'plans_manage',
        'reports_view',
        ...(role === 'owner' ? ['campaigns_manage'] : []),
      ];
    }
    return ['capacity_view', 'check_in_out', 'entry_queue'];
  }

  // Default: Salon
  if (isOwnerOrManager) {
    return [
      'queue_manage',
      'chairs_manage',
      'bookings_view',
      'staff_manage',
      'offers_manage',
      'salon_profile_manage',
      ...(role === 'owner' ? ['salon_settings'] : []),
    ];
  }
  return ['queue_manage', 'chairs_manage', 'bookings_view'];
}

export function resolveCategoryModules(mainCategoryId: MainCategoryType, role: StaffRole): CategoryModuleConfig[] {
  const cat = (mainCategoryId || 'salon').toLowerCase();

  if (cat === 'gym') {
    // Live Capacity, Check-in/Out and Entry Queue are consolidated into one
    // "Live Floor" module (backend/services for all three are unchanged and
    // still used internally by Live Floor's Inside/Waiting/Payments tabs).
    const modules: CategoryModuleConfig[] = [
      { id: 'overview', label: 'Overview', icon: 'LayoutDashboard', allowedRoles: ['owner', 'manager', 'staff', 'trainer', 'reception'] },
      { id: 'live_floor', label: 'Live Floor', icon: 'Activity', allowedRoles: ['owner', 'manager', 'staff', 'reception'] },
      { id: 'members', label: 'Members', icon: 'UsersRound', allowedRoles: ['owner', 'manager', 'staff', 'reception'] },
      { id: 'plans', label: 'Plans & Services', icon: 'Tag', allowedRoles: ['owner', 'manager'] },
      { id: 'classes', label: 'Classes', icon: 'CalendarDays', allowedRoles: ['owner', 'manager', 'trainer'] },
      { id: 'trainers', label: 'Trainers', icon: 'UserCheck', allowedRoles: ['owner', 'manager'] },
      { id: 'pt_bookings', label: 'PT Bookings', icon: 'Dumbbell', allowedRoles: ['owner', 'manager', 'trainer', 'reception'] },
      { id: 'reports', label: 'Reports', icon: 'ChartNoAxesCombined', allowedRoles: ['owner', 'manager'] },
      { id: 'campaigns', label: 'Campaigns', icon: 'Megaphone', allowedRoles: ['owner'] },
      // Every authenticated role reaches Settings — it is the only place
      // Sign Out lives now that the top header and sidebar footer no
      // longer carry it, so no role can end up trapped without a way to
      // log out. Owner/manager-only controls inside the screen (facility
      // settings, entry QR) still gate themselves.
      { id: 'settings', label: 'Gym Settings', icon: 'Settings', allowedRoles: ['owner', 'manager', 'staff', 'trainer', 'reception'] },
    ];
    return modules.filter((m) => m.allowedRoles.includes(role));
  }

  // Salon modules — mirrors the Gym registry shape: one flat list, filtered
  // by allowedRoles. Customers / Services & Pricing / Reports / Settings are
  // registered (so they render in the drawer and clamp/fallback correctly)
  // even though their screens are concept-only until backend support lands.
  const salonModules: CategoryModuleConfig[] = [
    { id: 'overview', label: 'Overview', icon: 'LayoutDashboard', allowedRoles: ['owner', 'manager', 'staff'] },
    { id: 'live', label: 'Live Salon', icon: 'Zap', allowedRoles: ['owner', 'manager', 'staff'] },
    { id: 'bookings', label: 'Bookings', icon: 'CalendarDays', allowedRoles: ['owner', 'manager', 'staff'] },
    { id: 'customers', label: 'Customers', icon: 'UsersRound', allowedRoles: ['owner', 'manager'] },
    { id: 'staff', label: 'Staff & Chairs', icon: 'Users', allowedRoles: ['owner', 'manager'] },
    { id: 'services', label: 'Services & Pricing', icon: 'Receipt', allowedRoles: ['owner', 'manager'] },
    { id: 'offers', label: 'Offers & Campaigns', icon: 'Tag', allowedRoles: ['owner', 'manager'] },
    { id: 'reports', label: 'Reports', icon: 'ChartNoAxesCombined', allowedRoles: ['owner', 'manager'] },
    { id: 'profile', label: 'Business Profile', icon: 'Building2', allowedRoles: ['owner', 'manager'] },
    // Every authenticated role reaches Settings — it is the only place
    // Sign Out lives now that the top header and drawer footer no longer
    // carry it, so no role can end up trapped without a way to log out.
    { id: 'settings', label: 'Settings', icon: 'Settings', allowedRoles: ['owner', 'manager', 'staff'] },
  ];
  return salonModules.filter((m) => m.allowedRoles.includes(role));
}

export function canAccessModule(mainCategoryId: MainCategoryType, role: StaffRole, moduleId: string): boolean {
  const modules = resolveCategoryModules(mainCategoryId, role);
  return modules.some((m) => m.id === moduleId);
}
