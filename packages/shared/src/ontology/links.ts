import type { LinkDef } from './types';
import type { ObjectTypeId } from './objects';

/** A link whose endpoints must be objects the ontology actually declares. */
export interface OntologyLink extends LinkDef {
  from: ObjectTypeId;
  to: ObjectTypeId;
}

/**
 * How the objects reach each other — the part a table list cannot show.
 *
 * Every row here is a real foreign key, named after the column that carries
 * it, so the map can be checked against a migration rather than believed. The
 * ones that cross a module boundary are the interesting ones: they are the
 * only places two parts of the company touch, and the registry derives the
 * dependency between modules from exactly these rows instead of trusting a
 * hand-written list to stay true.
 *
 * The rule for reading a row: `from` -> `to`, `cardinality` counted at the
 * `to` end ('many' = one `from` has many `to`), `foreignKey` being the column
 * that makes it so, on whichever table holds it.
 */
export const LINKS = [
  // -- Tashkilot ------------------------------------------------------------
  {
    id: 'tashkilot_xodimlari',
    title: 'Xodimlar',
    from: 'tashkilot',
    to: 'xodim',
    cardinality: 'many',
    foreignKey: 'memberships.org_id',
    inverse: 'Tashkiloti',
  },

  // -- Moliya ---------------------------------------------------------------
  {
    id: 'mijoz_tranzaksiyalari',
    title: 'Tranzaksiyalari',
    from: 'kontragent',
    to: 'tranzaksiya',
    cardinality: 'many',
    foreignKey: 'transactions.counterparty_id',
    inverse: 'Mijozi',
  },
  {
    id: 'tranzaksiya_turi',
    title: 'Operatsiya turi',
    from: 'tranzaksiya',
    to: 'kategoriya',
    cardinality: 'one',
    foreignKey: 'transactions.category_id',
    inverse: 'Tranzaksiyalari',
  },
  {
    // Who looks after this client — distinct from the manager on any one
    // despatch, which answers who handled that. The foreign key sits on a
    // Moliya table and points at a Tashkilot object: Moliya's one dependency.
    id: 'mijoz_menejeri',
    title: 'Menejeri',
    from: 'kontragent',
    to: 'xodim',
    cardinality: 'one',
    foreignKey: 'counterparties.manager_id',
    inverse: 'Yuritayotgan mijozlari',
  },

  // -- Sklad ----------------------------------------------------------------
  {
    id: 'mahsulot_partiyalari',
    title: 'Partiyalari',
    from: 'mahsulot',
    to: 'partiya',
    cardinality: 'many',
    foreignKey: 'sklad_batches.item_id',
    inverse: 'Mahsuloti',
  },
  {
    id: 'mahsulot_turi',
    title: 'Mahsulot turi',
    from: 'mahsulot',
    to: 'spravochnik',
    cardinality: 'one',
    foreignKey: 'sklad_items.product_type_id',
    inverse: 'Shu turdagi mahsulotlar',
  },
  {
    id: 'mahsulot_ip_turi',
    title: 'Ip turi',
    from: 'mahsulot',
    to: 'spravochnik',
    cardinality: 'one',
    foreignKey: 'sklad_items.yarn_type_id',
    inverse: 'Shu ipdagi mahsulotlar',
  },
  {
    id: 'mahsulot_sorti',
    title: 'Sorti',
    from: 'mahsulot',
    to: 'spravochnik',
    cardinality: 'one',
    foreignKey: 'sklad_items.sort_id',
    inverse: 'Shu sortdagi mahsulotlar',
  },
  {
    id: 'mahsulot_rangi',
    title: 'Rangi',
    from: 'mahsulot',
    to: 'spravochnik',
    cardinality: 'one',
    foreignKey: 'sklad_items.color_id',
    inverse: 'Shu rangdagi mahsulotlar',
  },
  {
    id: 'mahsulot_pantonesi',
    title: 'Pantone',
    from: 'mahsulot',
    to: 'spravochnik',
    cardinality: 'one',
    foreignKey: 'sklad_items.pantone_id',
    inverse: 'Shu pantonedagi mahsulotlar',
  },
  {
    // One row, hidden from staff by RLS rather than by the screen.
    id: 'partiya_narxi',
    title: 'Narxi',
    from: 'partiya',
    to: 'narx',
    cardinality: 'one',
    foreignKey: 'sklad_batch_prices.batch_id',
    inverse: 'Partiyasi',
  },
  {
    // The audit trail of the remainder: qoldiqDona is these, added up by
    // trigger. Nothing else may move it.
    id: 'partiya_harakatlari',
    title: 'Harakatlari',
    from: 'partiya',
    to: 'harakat',
    cardinality: 'many',
    foreignKey: 'sklad_movements.batch_id',
    inverse: 'Partiyasi',
  },
  {
    id: 'buyurtma_partiyalari',
    title: 'Partiyalari',
    from: 'buyurtma',
    to: 'partiya',
    cardinality: 'many',
    foreignKey: 'sklad_batches.order_id',
    inverse: 'Buyurtmasi',
  },
  {
    id: 'buyurtma_qatorlari',
    title: 'Qatorlari',
    from: 'buyurtma',
    to: 'buyurtma_qatori',
    cardinality: 'many',
    foreignKey: 'sklad_order_lines.order_id',
    inverse: 'Buyurtmasi',
  },
  {
    id: 'buyurtma_qatori_mahsuloti',
    title: 'Mahsuloti',
    from: 'buyurtma_qatori',
    to: 'mahsulot',
    cardinality: 'one',
    foreignKey: 'sklad_order_lines.item_id',
    inverse: 'Buyurtma qatorlari',
  },
  {
    id: 'buyurtma_qatori_yozuvlari',
    title: 'Bosqich yozuvlari',
    from: 'buyurtma_qatori',
    to: 'bosqich_yozuvi',
    cardinality: 'many',
    foreignKey: 'sklad_stage_entries.order_line_id',
    inverse: 'Buyurtma qatori',
  },
  {
    id: 'bosqich_yozuvlari',
    title: 'Yozuvlari',
    from: 'bosqich',
    to: 'bosqich_yozuvi',
    cardinality: 'many',
    foreignKey: 'sklad_stage_entries.stage_id',
    inverse: 'Bosqichi',
  },
  {
    id: 'buyurtma_mijozi',
    title: 'Mijozi',
    from: 'buyurtma',
    to: 'kontragent',
    cardinality: 'one',
    foreignKey: 'sklad_orders.counterparty_id',
    inverse: 'Buyurtmalari',
  },
  {
    id: 'buyurtma_masuli',
    title: 'Mas’uli',
    from: 'buyurtma',
    to: 'xodim',
    cardinality: 'one',
    foreignKey: 'sklad_orders.manager_id',
    inverse: 'Buyurtmalari',
  },
  {
    id: 'harakat_mijozi',
    title: 'Mijozi',
    from: 'harakat',
    to: 'kontragent',
    cardinality: 'one',
    foreignKey: 'sklad_movements.counterparty_id',
    inverse: 'Ombor harakatlari',
  },
  {
    id: 'harakat_buyurtmasi',
    title: 'Buyurtmasi',
    from: 'harakat',
    to: 'buyurtma',
    cardinality: 'one',
    foreignKey: 'sklad_movements.order_id',
    inverse: 'Ombor harakatlari',
  },

  // -- Sotuv ----------------------------------------------------------------
  {
    id: 'faktura_qatorlari',
    title: 'Qatorlari',
    from: 'faktura',
    to: 'faktura_qatori',
    cardinality: 'many',
    foreignKey: 'sklad_invoice_lines.invoice_id',
    inverse: 'Fakturasi',
  },
  {
    id: 'faktura_mijozi',
    title: 'Mijozi',
    from: 'faktura',
    to: 'kontragent',
    cardinality: 'one',
    foreignKey: 'sklad_invoices.counterparty_id',
    inverse: 'Fakturalari',
  },
  {
    id: 'faktura_menejeri',
    title: 'Menejeri',
    from: 'faktura',
    to: 'xodim',
    cardinality: 'one',
    foreignKey: 'sklad_invoices.manager_id',
    inverse: 'Yozgan fakturalari',
  },
  {
    id: 'faktura_buyurtmasi',
    title: 'Buyurtmasi',
    from: 'faktura',
    to: 'buyurtma',
    cardinality: 'one',
    foreignKey: 'sklad_invoices.order_id',
    inverse: 'Fakturalari',
  },
  {
    id: 'faktura_qatori_mahsuloti',
    title: 'Mahsuloti',
    from: 'faktura_qatori',
    to: 'mahsulot',
    cardinality: 'one',
    foreignKey: 'sklad_invoice_lines.item_id',
    inverse: 'Faktura qatorlari',
  },
  {
    id: 'faktura_qatori_partiyasi',
    title: 'Partiyasi',
    from: 'faktura_qatori',
    to: 'partiya',
    cardinality: 'one',
    foreignKey: 'sklad_invoice_lines.batch_id',
    inverse: 'Faktura qatorlari',
  },
  {
    id: 'faktura_qoplari',
    title: 'Qoplari',
    from: 'faktura',
    to: 'qop',
    cardinality: 'many',
    foreignKey: 'sklad_packages.invoice_id',
    inverse: 'Fakturasi',
  },
  {
    id: 'qop_qatorlari',
    title: 'Ichidagilar',
    from: 'qop',
    to: 'qop_qatori',
    cardinality: 'many',
    foreignKey: 'sklad_package_lines.package_id',
    inverse: 'Qopi',
  },
  {
    id: 'qop_qatori_mahsuloti',
    title: 'Mahsuloti',
    from: 'qop_qatori',
    to: 'mahsulot',
    cardinality: 'one',
    foreignKey: 'sklad_package_lines.item_id',
    inverse: 'Qop qatorlari',
  },
  {
    // The sack's line points at the lot it came out of, which is what makes
    // the write-off possible when the sack leaves. Packing itself moves
    // nothing — a sack on the floor is still stock.
    id: 'qop_qatori_partiyasi',
    title: 'Partiyasi',
    from: 'qop_qatori',
    to: 'partiya',
    cardinality: 'one',
    foreignKey: 'sklad_package_lines.batch_id',
    inverse: 'Qop qatorlari',
  },
  {
    id: 'jonatma_qoplari',
    title: 'Qoplari',
    from: 'jonatma',
    to: 'qop',
    cardinality: 'many',
    foreignKey: 'sklad_packages.shipment_id',
    inverse: 'Jo‘natmasi',
  },
  {
    id: 'jonatma_qatorlari',
    title: 'Qatorlari',
    from: 'jonatma',
    to: 'jonatma_qatori',
    cardinality: 'many',
    foreignKey: 'sklad_shipment_lines.shipment_id',
    inverse: 'Jo‘natmasi',
  },
  {
    id: 'jonatma_qatori_partiyasi',
    title: 'Partiyasi',
    from: 'jonatma_qatori',
    to: 'partiya',
    cardinality: 'one',
    foreignKey: 'sklad_shipment_lines.batch_id',
    inverse: 'Jo‘natma qatorlari',
  },
  {
    id: 'jonatma_qatori_buyurtma_qatori',
    title: 'Buyurtma qatori',
    from: 'jonatma_qatori',
    to: 'buyurtma_qatori',
    cardinality: 'one',
    foreignKey: 'sklad_shipment_lines.order_line_id',
    inverse: 'Jo‘natma qatorlari',
  },
  {
    id: 'jonatma_fakturasi',
    title: 'Fakturasi',
    from: 'jonatma',
    to: 'faktura',
    cardinality: 'one',
    foreignKey: 'sklad_shipments.invoice_id',
    inverse: 'Jo‘natmalari',
  },
  {
    id: 'jonatma_mijozi',
    title: 'Mijozi',
    from: 'jonatma',
    to: 'kontragent',
    cardinality: 'one',
    foreignKey: 'sklad_shipments.counterparty_id',
    inverse: 'Jo‘natmalari',
  },
  {
    id: 'jonatma_buyurtmasi',
    title: 'Buyurtmasi',
    from: 'jonatma',
    to: 'buyurtma',
    cardinality: 'one',
    foreignKey: 'sklad_shipments.order_id',
    inverse: 'Jo‘natmalari',
  },
  {
    id: 'jonatma_menejeri',
    title: 'Menejeri',
    from: 'jonatma',
    to: 'xodim',
    cardinality: 'one',
    foreignKey: 'sklad_shipments.manager_id',
    inverse: 'Jo‘natmalari',
  },
] as const satisfies readonly OntologyLink[];

export type LinkId = (typeof LINKS)[number]['id'];
