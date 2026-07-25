import { z } from 'zod';

export const accountTypeSchema = z.enum(['receivable', 'cash', 'sales', 'inventory', 'other']);

export const orgRoleSchema = z.enum(['owner', 'admin', 'staff']);

export const fundSourceSchema = z.enum(['fabrika', 'shaxsiy']);

export const organizationInputSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Faqat kichik lotin harflari, raqamlar va tire'),
  baseCurrency: z.string().length(3).default('UZS'),
});
export type OrganizationInput = z.infer<typeof organizationInputSchema>;

export const counterpartyInputSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  categories: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional(),
  currency: z.string().length(3).optional(),
});
export type CounterpartyInput = z.infer<typeof counterpartyInputSchema>;

/**
 * What the entry form (mobile/web) collects. The debit/credit account ids
 * are resolved server-side (or client-side from the chosen category's
 * defaults) rather than picked freely by the user.
 */
export const transactionInputSchema = z.object({
  orgId: z.string().uuid(),
  counterpartyId: z.string().uuid(),
  categoryId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  quantityKg: z.number().positive().optional(),
  quantityDona: z.number().positive().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  source: fundSourceSchema,
  clientLocalId: z.string().uuid(),
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

/** Editing an existing transaction: same fields, keyed by id, no offline-sync id needed. */
export const transactionUpdateSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  counterpartyId: z.string().uuid(),
  categoryId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  quantityKg: z.number().positive().optional(),
  quantityDona: z.number().positive().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  source: fundSourceSchema,
});
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
