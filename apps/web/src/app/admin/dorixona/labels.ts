// Dorixona tarmoqlari — holat va xodim rollari yorliqlari (o'zbekcha, operator uchun).
import type { NetworkStatus, StaffRole } from '@/lib/dorixona';

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'brand';

export const NETWORK_STATUSES: NetworkStatus[] = ['trial', 'active', 'suspended'];

const statusLabels: Record<NetworkStatus, string> = {
  trial: 'Sinov',
  active: 'Faol',
  suspended: "To'xtatilgan",
};

const statusTones: Record<NetworkStatus, Tone> = {
  trial: 'warning',
  active: 'success',
  suspended: 'danger',
};

export function networkStatusLabel(status: NetworkStatus): string {
  return statusLabels[status] ?? status;
}

export function networkStatusTone(status: NetworkStatus): Tone {
  return statusTones[status] ?? 'neutral';
}

const roleLabels: Record<StaffRole, string> = {
  network_admin: 'Tarmoq administratori',
  branch_admin: 'Filial administratori',
  pharmacist: 'Farmatsevt',
  operator: 'Operator',
  courier: 'Kuryer',
};

export function staffRoleLabel(role: StaffRole): string {
  return roleLabels[role] ?? role;
}

// Bu yerdan faqat filialga bog'lanmagan rollar qo'shiladi; filial xodimlarini
// tarmoq administratori o'z panelida (dorixona.idaa.uz/panel) qo'shadi.
export const ADMIN_STAFF_ROLES: StaffRole[] = ['network_admin', 'operator', 'courier'];
