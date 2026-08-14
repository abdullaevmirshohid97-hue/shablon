import type { ObjectTypeDef } from './types';

/**
 * Every noun the company uses, and which module is answerable for it.
 *
 * The properties listed are the ones the business talks about, not every column
 * of the table — an ontology that mirrors the schema row for row is just the
 * schema again, and would have to be edited twice for every migration. What it
 * must be exact about is `owner`, `table` and the money: a property marked
 * `restricted` is one row-level security hides from staff, and a screen that
 * forgets that shows a column of blanks and calls it a bug in the database.
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
    titleProperty: 'fullName',
    properties: [
      { id: 'fullName', title: 'F.I.O.', kind: 'text' },
      { id: 'email', title: 'Email', kind: 'text' },
      { id: 'role', title: 'Roli', kind: 'status' },
      // The PIN itself is never readable — only verify_finance_pin sees it.
      { id: 'hasPin', title: 'PIN o‘rnatilgan', kind: 'status', restricted: true },
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
      { id: 'managerId', title: 'Menejeri', kind: 'ref' },
      { id: 'totalDebt', title: 'Jami qarz', kind: 'money', derived: true },
      // Not a slice of totalDebt: what was outstanding when the deadline
      // passed, less everything paid since. See CounterpartyJournalRow.
      { id: 'overdueAmount', title: 'Muddati o‘tgan', kind: 'money', derived: true },
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
    titleProperty: 'label',
    properties: [
      { id: 'label', title: 'Davr', kind: 'text' },
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
      // A lot is named by the card it came off. Denormalised onto the row by
      // sklad_batch_page rather than stored, which is why it is derived.
      { id: 'itemName', title: 'Mahsuloti', kind: 'text', derived: true },
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
      { id: 'omborgaKirganSana', title: 'Omborga kirgan sana', kind: 'date' },
      { id: 'locationSector', title: 'Joylashuvi', kind: 'text' },
    ],
  },
  {
    id: 'narx',
    title: 'Narx',
    plural: 'Narxlar',
    owner: 'sklad',
    table: 'sklad_batch_prices',
    titleProperty: 'totalAmount',
    // A separate table so RLS can hide it row for row; every property below is
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
    titleProperty: 'occurredAt',
    properties: [
      { id: 'qtyIn', title: 'Kirdi', kind: 'quantity', unit: 'dona' },
      { id: 'qtyOut', title: 'Chiqdi', kind: 'quantity', unit: 'dona' },
      { id: 'defectQty', title: 'Brak', kind: 'quantity', unit: 'dona' },
      { id: 'kg', title: 'Og‘irligi', kind: 'quantity', unit: 'kg' },
      { id: 'executorName', title: 'Bajaruvchi', kind: 'text' },
      { id: 'occurredAt', title: 'Sanasi', kind: 'date' },
    ],
  },

  // -------------------------------------------------------------------------
  // Sotuv — the paper a manager raises, the sacks the floor packs against it,
  // and the lorry it leaves on. All three write stock movements into Sklad,
  // which is why Sotuv declares partiya as a read and never touches it itself.
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
      { id: 'totalAmount', title: 'Jami summa', kind: 'money' },
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
      { id: 'itemName', title: 'Mahsuloti', kind: 'text', derived: true },
      { id: 'orderedDona', title: 'Buyurtma', kind: 'quantity', unit: 'dona' },
      { id: 'shippedDona', title: 'Jo‘natilgan', kind: 'quantity', unit: 'dona', derived: true },
      { id: 'remainingDona', title: 'Qoldi', kind: 'quantity', unit: 'dona', derived: true },
      { id: 'unitPrice', title: 'Narxi', kind: 'money' },
      { id: 'amount', title: 'Summasi', kind: 'money', derived: true },
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
      { id: 'contents', title: 'Ichida', kind: 'text', derived: true },
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
      { id: 'itemName', title: 'Mahsuloti', kind: 'text', derived: true },
      // The product barcode, repeated on the sack's line: what a scanner reads
      // to tell the red rose from the yellow one.
      { id: 'itemBarcode', title: 'Shtrix kod', kind: 'code', derived: true },
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
    titleProperty: 'dona',
    properties: [
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
