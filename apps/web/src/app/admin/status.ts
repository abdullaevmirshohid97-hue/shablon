// Super-admin panel — subscription va rol yorliqlari (o'zbekcha, operator uchun).
// Panel faqat platform operatori uchun, shuning uchun matn shu yerda qattiq yozilgan
// (tenant ilova esa shared i18n uz/ru ishlatadi).

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';
export type OrgRole = 'owner' | 'admin' | 'staff';
type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'brand';

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
];

const subscriptionLabels: Record<SubscriptionStatus, string> = {
  trialing: 'Sinov muddati',
  active: 'Faol',
  past_due: "To'lov kechikkan",
  canceled: 'Bekor qilingan',
};

const subscriptionTones: Record<SubscriptionStatus, Tone> = {
  trialing: 'warning',
  active: 'success',
  past_due: 'danger',
  canceled: 'neutral',
};

export function subscriptionLabel(status: SubscriptionStatus): string {
  return subscriptionLabels[status] ?? status;
}

export function subscriptionTone(status: SubscriptionStatus): Tone {
  return subscriptionTones[status] ?? 'neutral';
}

const roleLabels: Record<OrgRole, string> = {
  owner: 'Egasi',
  admin: 'Administrator',
  staff: 'Xodim',
};

export function roleLabel(role: OrgRole): string {
  return roleLabels[role] ?? role;
}
