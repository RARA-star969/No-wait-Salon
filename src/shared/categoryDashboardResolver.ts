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
        'reports_view',
        ...(role === 'owner' ? ['campaigns_manage'] : []),
      ];
    }
    return ['capacity_view', 'check_in_out', 'entry_queue'];
  }

  // Default: Salon
  if (isOwnerOrManager) {
    return ['queue_manage', 'chairs_manage', 'staff_manage', 'offers_manage', 'salon_settings'];
  }
  return ['queue_manage', 'chairs_manage'];
}

export function resolveCategoryModules(mainCategoryId: MainCategoryType, role: StaffRole): CategoryModuleConfig[] {
  const cat = (mainCategoryId || 'salon').toLowerCase();

  if (cat === 'gym') {
    const modules: CategoryModuleConfig[] = [
      { id: 'overview', label: 'Overview', icon: 'LayoutDashboard', allowedRoles: ['owner', 'manager', 'staff', 'trainer', 'reception'] },
      { id: 'capacity', label: 'Live Capacity', icon: 'Users', allowedRoles: ['owner', 'manager', 'staff', 'reception'] },
      { id: 'checkin', label: 'Check-in / Out', icon: 'QrCode', allowedRoles: ['owner', 'manager', 'staff', 'reception'] },
      { id: 'queue', label: 'Entry Queue', icon: 'ListOrdered', allowedRoles: ['owner', 'manager', 'staff', 'reception'] },
      { id: 'classes', label: 'Classes', icon: 'CalendarDays', allowedRoles: ['owner', 'manager', 'trainer'] },
      { id: 'trainers', label: 'Trainers', icon: 'UserCheck', allowedRoles: ['owner', 'manager'] },
      { id: 'pt_bookings', label: 'PT Bookings', icon: 'Dumbbell', allowedRoles: ['owner', 'manager', 'trainer', 'reception'] },
      { id: 'members', label: 'Members', icon: 'UsersRound', allowedRoles: ['owner', 'manager', 'staff', 'reception'] },
      { id: 'reports', label: 'Reports', icon: 'ChartNoAxesCombined', allowedRoles: ['owner', 'manager'] },
      { id: 'campaigns', label: 'Campaigns', icon: 'Megaphone', allowedRoles: ['owner'] },
      { id: 'settings', label: 'Gym Settings', icon: 'Settings', allowedRoles: ['owner'] },
    ];
    return modules.filter((m) => m.allowedRoles.includes(role));
  }

  // Salon modules
  const salonModules: CategoryModuleConfig[] = [
    { id: 'queue', label: 'Live Queue', icon: 'ListOrdered', allowedRoles: ['owner', 'manager', 'staff'] },
    { id: 'chairs', label: 'Chairs & Stylists', icon: 'Scissors', allowedRoles: ['owner', 'manager', 'staff'] },
    { id: 'staff', label: 'Manage Staff', icon: 'Users', allowedRoles: ['owner', 'manager'] },
    { id: 'offers', label: 'Offers & Coupons', icon: 'Tag', allowedRoles: ['owner', 'manager'] },
  ];
  return salonModules.filter((m) => m.allowedRoles.includes(role));
}

export function canAccessModule(mainCategoryId: MainCategoryType, role: StaffRole, moduleId: string): boolean {
  const modules = resolveCategoryModules(mainCategoryId, role);
  return modules.some((m) => m.id === moduleId);
}
