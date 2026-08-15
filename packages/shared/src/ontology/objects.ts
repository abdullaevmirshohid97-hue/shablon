import type { ObjectTypeDef } from './types';

/**
 * Every noun the company uses, and which module is answerable for it.
 *
 * The properties listed are the ones the business talks about, not every column
 * of the table — an ontology that mirrors the schema row for row is just the
 * schema again, and would have to be edited twice for every migration. What it
 * must be exact about is three things:
 *
 *   `owner`     — the one module that writes it.
 *   `table`     — plus `primaryKey` where a row is not addressed by `id`.
 *   `column`    — omitted where it is the snake_case of the property, `null`
 *                 where the property is not stored at all. A generic reader
 *                 selects exactly the stored ones, so a wrong answer here is a
 *                 failed query rather than a wrong number.
 *
 * `restricted` marks what row-level security hides from staff — those come back
 * null rather than zero, and a screen that forgets it shows a column of blanks
 * and calls it a bug in the database.
 */
export const OBJECT_TYPES = [
  // -------------------------------------------------------------------------
  // Tashkilot — the company itself and the people in it. Owned centrally
  // because every other module reads them and none of them may rewrite them.
  // -------------------------------------------------------------------------
  {
    id: 'tashkilot',
    title: 'Tashkilot',
    plural: 'Tashkilotlar',
    owner: 'tashkilot',
    table: 'organizations',
    // The company is not inside a company: its own id is the tenant key.
    orgScoped: false,
    titleProperty: 'name',
    properties: [
      { id: 'name', title: 'Nomi', kind: 'text' },
      { id: 'slug', title: 'Manzil', kind: 'code' },
      { id: 'baseCurrency', title: 'Asosiy valyuta', kind: 'code' },
      { id: 'subscriptionStatus', title: 'Obuna holati', kind: 'status' },
    ],
  },
  {
    id: 'xodim',
    title: 'Xodim',
    plural: 'Xodimlar',
    owner: 'tashkilot',
    table: 'memberships',
    // No id column at all: a membership is one person in one company.
    primaryKey: 'user_id',
    titleProperty: 'fullName',
    properties: [
      // The name lives on the profile, which is why the object links to one.
      { id: 'fullName', title: 'F.I.O.', kind: 'text', column: null },
      { id: 'role', title: 'Roli', kind: 'status' },
      // Stored as a hash and never selectable; list_org_roster and
      // has_finance_pin are the only honest ways to ask about it.
      { id: 'hasPin', title: 'PIN o‘rnatilgan', kind: 'status', column: null, restricted: true },
    ],
  },
  {
    id: 'profil',
    title: 'Profil',
    plural: 'Profillar',
    owner: 'tashkilot',
    table: 'profiles',
    // One person, one profile, whichever companies they belong to.
    orgScoped: false,
    titleProperty: 'fullName',
    properties: [
      { id: 'fullName', title: 'F.I.O.', kind: 'text' },
      { id: 'phone', title: 'Telefon', kind: 'text' },
      { id: 'rolePlatform', title: 'Platforma roli', kind: 'status' },
    ],
  },

  // -------------------------------------------------------------------------
  // Moliya — the ledger, and the client register it is kept against. The
  // counterparty lives here rather than in Sotuv because the debt figure is
  // the ledger's answer, and a sales screen that could edit the client would
  // be editing the subject of the accounts.
  // -------------------------------------------------------------------------
  {
    id: 'kontragent',
    title: 'Mijoz',
    plural: 'Mijozlar',
    owner: 'moliya',
    table: 'counterparties',
    titleProperty: 'name',
    href: '/counterparty/:id',
    properties: [
      { id: 'name', title: 'Nomi', kind: 'text' },
      { id: 'phone', title: 'Telefon', kind: 'text' },
      { id: 'categories', title: 'Toifalari', kind: 'text' },
      { id: 'currency', title: 'Valyuta', kind: 'code' },
      { id: 'notes', title: 'Izoh', kind: 'text' },
      { id: 'managerId', title: 'Menejeri', kind: 'ref' },
      // Both come out of counterparty_journal, not off the row: the balance is
      // the ledger's answer, and it is arrived at rather than stored.
      { id: 'totalDebt', title: 'Jami qarz', kind: 'money', column: null, derived: true },
      // Not a slice of totalDebt: what was outstanding when the deadline
      // passed, less everything paid since.
      { id: 'overdueAmount', title: 'Muddati o‘tgan', kind: 'money', column: null, derived: true },
    ],
  },
  {
    id: 'hisob',
    title: 'Hisob raqam',
    plural: 'Hisob raqamlar',
    owner: 'moliya',
    table: 'accounts',
    titleProperty: 'name',
    properties: [
      { id: 'code', title: 'Kodi', kind: 'code' },
      { id: 'name', title: 'Nomi', kind: 'text' },
      { id: 'type', title: 'Turi', kind: 'status' },
    ],
  },
  {
    id: 'kategoriya',
    title: 'Operatsiya turi',
    plural: 'Operatsiya turlari',
    owner: 'moliya',
    table: 'transaction_categories',
    titleProperty: 'name',
    properties: [
      { id: 'name', title: 'Nomi', kind: 'text' },
      { id: 'unit', title: 'O‘lchov birligi', kind: 'text' },
    ],
  },
  {
    id: 'tranzaksiya',
    title: 'Tranzaksiya',
    plural: 'Tranzaksiyalar',
    owner: 'moliya',
    table: 'transactions',
    titleProperty: 'documentNo',
    properties: [
      { id: 'documentNo', title: 'Hujjat raqami', kind: 'code' },
      { id: 'occurredAt', title: 'Sanasi', kind: 'date' },
      { id: 'dueDate', title: 'To‘lov muddati', kind: 'date' },
      { id: 'description', title: 'Tavsifi', kind: 'text' },
      { id: 'debitAmount', title: 'Debet', kind: 'money' },
      { id: 'creditAmount', title: 'Kredit', kind: 'money' },
      { id: 'quantityKg', title: 'Miqdori', kind: 'quantity', unit: 'kg' },
      { id: 'quantityDona', title: 'Miqdori', kind: 'quantity', unit: 'dona' },
      { id: 'currency', title: 'Valyuta', kind: 'code' },
      { id: 'source', title: 'Manba', kind: 'status' },
      { id: 'status', title: 'Holati', kind: 'status' },
    ],
  },
  {
    id: 'davr',
    title: 'Hisobot davri',
    plural: 'Hisobot davrlari',
    owner: 'moliya',
    table: 'accounting_periods',
    titleProperty: 'name',
    properties: [
      { id: 'name', title: 'Davr', kind: 'text' },
      { id: 'startDate', title: 'Boshlanishi', kind: 'date' },
      { id: 'endDate', title: 'Tugashi', kind: 'date' },
      { id: 'status', title: 'Holati', kind: 'status' },
    ],
  },

  // -------------------------------------------------------------------------
  // Sklad — what exists physically, and what the shops did to it. Goods *out*
  // is not here: issuing stock is the last step of a sale, so it belongs to
  // Sotuv along with the invoice that authorises it.
  // -------------------------------------------------------------------------
  {
    id: 'mahsulot',
    title: 'Mahsulot kartasi',
    plural: 'Mahsulot kartalari',
    owner: 'sklad',
    table: 'sklad_items',
    titleProperty: 'name',
    properties: [
      { id: 'kod', title: 'Kodi', kind: 'code' },
      { id: 'name', title: 'Nomi', kind: 'text' },
      // Assigned once, never changed: a scanner reading it must always get the
      // same card back. See 0033.
      { id: 'barcode', title: 'Shtrix kod', kind: 'code' },
      { id: 'gsm', title: 'Zichligi', kind: 'number' },
      { id: 'widthCm', title: 'Eni', kind: 'quantity', unit: 'sm' },
      { id: 'lengthCm', title: 'Uzunligi', kind: 'quantity', unit: 'sm' },
      { id: 'productTypeId', title: 'Mahsulot turi', kind: 'ref' },
      { id: 'yarnTypeId', title: 'Ip turi', kind: 'ref' },
      { id: 'sortId', title: 'Sorti', kind: 'ref' },
      { id: 'colorId', title: 'Rangi', kind: 'ref' },
      { id: 'pantoneId', title: 'Pantone', kind: 'ref' },
    ],
  },
  {
    id: 'spravochnik',
    title: 'Ma’lumotnoma',
    plural: 'Ma’lumotnomalar',
    owner: 'sklad',
    table: 'sklad_lookups',
    titleProperty: 'name',
    properties: [
      { id: 'kind', title: 'Turi', kind: 'status' },
      { id: 'name', title: 'Qiymati', kind: 'text' },
    ],
  },
  {
    id: 'partiya',
    title: 'Partiya',
    plural: 'Partiyalar',
    owner: 'sklad',
    table: 'sklad_batches',
    titleProperty: 'itemName',
    properties: [
      // A lot is named by the card it came off, which is a join away — the
      // link to mahsulot is how a screen actually gets it.
      { id: 'itemName', title: 'Mahsuloti', kind: 'text', column: null, derived: true },
      { id: 'bruttoKg', title: 'Brutto', kind: 'quantity', unit: 'kg' },
      { id: 'nettoKg', title: 'Netto', kind: 'quantity', unit: 'kg' },
      { id: 'taraKg', title: 'Tara', kind: 'quantity', unit: 'kg', derived: true },
      { id: 'donaSoni', title: 'Dona soni', kind: 'quantity', unit: 'dona' },
      { id: 'naborSoni', title: 'Nabor soni', kind: 'quantity', unit: 'nabor' },
      { id: 'qopSoni', title: 'Qop soni', kind: 'quantity', unit: 'qop' },
      { id: 'pieceWeightKg', title: 'Dona og‘irligi', kind: 'quantity', unit: 'kg', derived: true },
      // Moved by trigger from the batch's movements (0022). To change it,
      // record a movement — an action that writes it directly is a bug.
      { id: 'qoldiqDona', title: 'Qoldiq', kind: 'quantity', unit: 'dona', derived: true },
      { id: 'status', title: 'Holati', kind: 'status' },
      { id: 'ishlabChiqarilganSana', title: 'Ishlab chiqarilgan', kind: 'date' },
      { id: 'omborgaKirganSana', title: 'Omborga kirgan sana', kind: 'date' },
      { id: 'locationSector', title: 'Joylashuvi', kind: 'text' },
      { id: 'notes', title: 'Izoh', kind: 'text' },
    ],
  },
  {
    id: 'narx',
    title: 'Narx',
    plural: 'Narxlar',
    owner: 'sklad',
    table: 'sklad_batch_prices',
    // Keyed by the lot it prices: one price row per batch, or none.
    primaryKey: 'batch_id',
    titleProperty: 'totalAmount',
    // A separate table so RLS can hide it row for row; every figure below is
    // null for staff, not zero.
    properties: [
      { id: 'pricePerKg', title: 'Kg narxi', kind: 'money', restricted: true },
      { id: 'pricePerPiece', title: 'Dona narxi', kind: 'money', restricted: true },
      { id: 'totalAmount', title: 'Jami summa', kind: 'money', restricted: true },
      { id: 'purchaseCost', title: 'Tannarx', kind: 'money', restricted: true },
      { id: 'profitAmount', title: 'Foyda', kind: 'money', restricted: true },
      { id: 'currency', title: 'Valyuta', kind: 'code' },
    ],
  },
  {
    id: 'harakat',
    title: 'Harakat',
    plural: 'Harakatlar',
    owner: 'sklad',
    table: 'sklad_movements',
    titleProperty: 'kind',
    properties: [
      { id: 'kind', title: 'Turi', kind: 'status' },
      // Signed: what it did to the stock, not how big it was.
      { id: 'dona', title: 'Dona', kind: 'quantity', unit: 'dona' },
      { id: 'kg', title: 'Og‘irligi', kind: 'quantity', unit: 'kg' },
      { id: 'occurredAt', title: 'Sanasi', kind: 'date' },
      { id: 'isInitial', title: 'Boshlang‘ich', kind: 'status' },
      { id: 'note', title: 'Izoh', kind: 'text' },
    ],
  },
  {
    id: 'buyurtma',
    title: 'Buyurtma',
    plural: 'Buyurtmalar',
    owner: 'sklad',
    table: 'sklad_orders',
    titleProperty: 'orderNo',
    href: '/hub/sklad/orders/:id',
    properties: [
      { id: 'orderNo', title: 'Raqami', kind: 'code' },
      { id: 'orderName', title: 'Nomi', kind: 'text' },
      { id: 'deadline', title: 'Muddati', kind: 'date' },
      { id: 'status', title: 'Holati', kind: 'status' },
      { id: 'managerId', title: 'Mas’ul', kind: 'ref' },
      { id: 'notes', title: 'Izoh', kind: 'text' },
    ],
  },
  {
    id: 'buyurtma_qatori',
    title: 'Buyurtma qatori',
    plural: 'Buyurtma qatorlari',
    owner: 'sklad',
    table: 'sklad_order_lines',
    titleProperty: 'description',
    properties: [
      { id: 'position', title: 'No', kind: 'number' },
      { id: 'description', title: 'Tavsifi', kind: 'text' },
      { id: 'sizeText', title: 'O‘lchami', kind: 'text' },
      { id: 'colorText', title: 'Rangi', kind: 'text' },
      { id: 'plannedDona', title: 'Reja', kind: 'quantity', unit: 'dona' },
      { id: 'plannedKg', title: 'Reja', kind: 'quantity', unit: 'kg' },
      { id: 'notes', title: 'Izoh', kind: 'text' },
    ],
  },
  {
    id: 'bosqich',
    title: 'Bosqich',
    plural: 'Bosqichlar',
    owner: 'sklad',
    table: 'sklad_stages',
    titleProperty: 'name',
    properties: [
      { id: 'name', title: 'Nomi', kind: 'text' },
      { id: 'position', title: 'Tartibi', kind: 'number' },
      // Exactly one stage is the finished-goods warehouse; its output is what
      // becomes shippable.
      { id: 'isFinal', title: 'Yakuniy', kind: 'status' },
    ],
  },
  {
    id: 'bosqich_yozuvi',
    title: 'Bosqich yozuvi',
    plural: 'Bosqich yozuvlari',
    owner: 'sklad',
    table: 'sklad_stage_entries',
    titleProperty: 'executorName',
    properties: [
      { id: 'executorName', title: 'Bajaruvchi', kind: 'text' },
      { id: 'qtyIn', title: 'Kirdi', kind: 'quantity', unit: 'dona' },
      { id: 'qtyOut', title: 'Chiqdi', kind: 'quantity', unit: 'dona' },
      { id: 'defectQty', title: 'Brak', kind: 'quantity', unit: 'dona' },
      { id: 'kg', title: 'Og‘irligi', kind: 'quantity', unit: 'kg' },
      { id: 'occurredAt', title: 'Sanasi', kind: 'date' },
      { id: 'note', title: 'Izoh', kind: 'text' },
    ],
  },

  // -------------------------------------------------------------------------
  // Sotuv — the paper a manager raises, the sacks the floor packs against it,
  // and the lorry it leaves on. All three end in stock movements inside Sklad,
  // which is why Sotuv declares partiya as a read and never writes it itself.
  // -------------------------------------------------------------------------
  {
    id: 'faktura',
    title: 'Faktura',
    plural: 'Fakturalar',
    owner: 'sotuv',
    table: 'sklad_invoices',
    titleProperty: 'invoiceNo',
    href: '/hub/sotuv/faktura/:id',
    properties: [
      { id: 'invoiceNo', title: 'Raqami', kind: 'code' },
      { id: 'barcode', title: 'Shtrix kod', kind: 'code' },
      { id: 'status', title: 'Holati', kind: 'status' },
      { id: 'issuedAt', title: 'Sanasi', kind: 'date' },
      { id: 'dueDate', title: 'To‘lov muddati', kind: 'date' },
      { id: 'currency', title: 'Valyuta', kind: 'code' },
      { id: 'note', title: 'Izoh', kind: 'text' },
      // Added up from the lines by sklad_invoice_page, never stored on the
      // header — a header total and line totals that can disagree is how an
      // invoice starts lying.
      { id: 'totalAmount', title: 'Jami summa', kind: 'money', column: null, derived: true },
    ],
  },
  {
    id: 'faktura_qatori',
    title: 'Faktura qatori',
    plural: 'Faktura qatorlari',
    owner: 'sotuv',
    table: 'sklad_invoice_lines',
    titleProperty: 'itemName',
    properties: [
      { id: 'itemName', title: 'Mahsuloti', kind: 'text', column: null, derived: true },
      { id: 'position', title: 'No', kind: 'number' },
      { id: 'dona', title: 'Buyurtma', kind: 'quantity', unit: 'dona' },
      { id: 'kg', title: 'Og‘irligi', kind: 'quantity', unit: 'kg' },
      { id: 'unitPrice', title: 'Narxi', kind: 'money' },
      { id: 'amount', title: 'Summasi', kind: 'money' },
      // What has actually gone out against this line, and what is left: both
      // are counted from the despatches, not stored beside the order figure.
      {
        id: 'shippedDona',
        title: 'Jo‘natilgan',
        kind: 'quantity',
        unit: 'dona',
        column: null,
        derived: true,
      },
      {
        id: 'remainingDona',
        title: 'Qoldi',
        kind: 'quantity',
        unit: 'dona',
        column: null,
        derived: true,
      },
    ],
  },
  {
    id: 'qop',
    title: 'Qop',
    plural: 'Qoplar',
    owner: 'sotuv',
    table: 'sklad_packages',
    titleProperty: 'code',
    href: '/hub/sotuv/qop/:id',
    properties: [
      // The QR names the sack; the barcode on the label names the product
      // inside it. Two codes because they answer two different questions.
      { id: 'code', title: 'Qop kodi', kind: 'code' },
      { id: 'barcode', title: 'QR kod', kind: 'code' },
      { id: 'status', title: 'Holati', kind: 'status' },
      { id: 'packedAt', title: 'Qadoqlangan', kind: 'date' },
      { id: 'grossKg', title: 'Brutto', kind: 'quantity', unit: 'kg' },
      { id: 'note', title: 'Izoh', kind: 'text' },
      // "Qizil atirgul x 50, Sariq atirgul x 20" — the label's own summary,
      // assembled from the lines.
      { id: 'contents', title: 'Ichida', kind: 'text', column: null, derived: true },
    ],
  },
  {
    id: 'qop_qatori',
    title: 'Qop qatori',
    plural: 'Qop qatorlari',
    owner: 'sotuv',
    table: 'sklad_package_lines',
    titleProperty: 'itemName',
    properties: [
      { id: 'itemName', title: 'Mahsuloti', kind: 'text', column: null, derived: true },
      // The product barcode, reached through the line's item.
      { id: 'itemBarcode', title: 'Shtrix kod', kind: 'code', column: null, derived: true },
      { id: 'position', title: 'No', kind: 'number' },
      { id: 'dona', title: 'Dona', kind: 'quantity', unit: 'dona' },
      { id: 'kg', title: 'Og‘irligi', kind: 'quantity', unit: 'kg' },
    ],
  },
  {
    id: 'jonatma',
    title: 'Jo‘natma',
    plural: 'Jo‘natmalar',
    owner: 'sotuv',
    table: 'sklad_shipments',
    titleProperty: 'documentNo',
    href: '/hub/sotuv/chiqim/:id',
    properties: [
      { id: 'documentNo', title: 'Hujjat raqami', kind: 'code' },
      { id: 'shippedAt', title: 'Jo‘natilgan sana', kind: 'date' },
      { id: 'note', title: 'Izoh', kind: 'text' },
    ],
  },
  {
    id: 'jonatma_qatori',
    title: 'Jo‘natma qatori',
    plural: 'Jo‘natma qatorlari',
    owner: 'sotuv',
    table: 'sklad_shipment_lines',
    titleProperty: 'note',
    properties: [
      // The despatch line carries the sack's code as its note, so the paper
      // that travels says which sack each figure came out of.
      { id: 'note', title: 'Qop kodi', kind: 'code' },
      { id: 'dona', title: 'Dona', kind: 'quantity', unit: 'dona' },
      { id: 'kg', title: 'Og‘irligi', kind: 'quantity', unit: 'kg' },
    ],
  },
] as const satisfies readonly ObjectTypeDef[];

/**
 * Every object the ontology knows, as a type. Derived rather than written out,
 * so a new object type is registered by adding it above and nowhere else — and
 * so links and module manifests that name a nonexistent object fail to compile
 * rather than fail at runtime.
 */
export type ObjectTypeId = (typeof OBJECT_TYPES)[number]['id'];
