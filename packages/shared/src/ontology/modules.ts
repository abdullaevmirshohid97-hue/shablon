import type { ModuleDef } from './types';
import type { ObjectTypeId } from './objects';

/** A manifest whose reads and actions may only name declared objects. */
export interface OntologyModule extends ModuleDef {
  reads: readonly ObjectTypeId[];
  actions: readonly (ModuleDef['actions'][number] & {
    appliesTo: ObjectTypeId;
    writes: readonly ObjectTypeId[];
    reads: readonly ObjectTypeId[];
  })[];
}

/**
 * One manifest per part of the company: its duty, what it leans on, what it
 * lets people do, and which screens it puts in the rail.
 *
 * What is *not* here is what each module owns — that is written on the objects
 * themselves and derived, because a fact kept in two places is a fact that
 * will disagree with itself by the third module. A manifest declares only what
 * it cannot know alone: its dependencies.
 *
 * Read the `reads` lines together and the shape of the business appears, in
 * one direction and without a cycle:
 *
 *     tashkilot  <-  moliya  <-  sklad  <-  sotuv
 *
 * Sotuv leans on the warehouse and the ledger; the warehouse leans on the
 * ledger's client register; the ledger leans only on the staff list; the staff
 * list leans on nothing. Adding a module means adding an arrow into this, not
 * rewiring it.
 */
export const MODULES = [
  {
    id: 'tashkilot',
    titleKey: 'nav.organization',
    href: '/hub/settings',
    icon: 'settings',
    purpose:
      'Kompaniyaning o‘zi va undagi odamlar: kim ishlaydi, kim nima qila oladi, kim qaysi PIN bilan kiradi. Boshqa modullar bularni faqat o‘qiydi.',
    reads: [],
    hubGroupKey: 'hub.settings',
    adminOnly: true,
    gated: false,
    actions: [
      {
        id: 'xodim_yaratish',
        title: 'Xodim qo‘shish',
        appliesTo: 'xodim',
        writes: ['xodim'],
        reads: [],
        adminOnly: true,
        rpc: 'create_employee',
      },
      {
        id: 'xodim_tahrirlash',
        title: 'Xodimni tahrirlash',
        appliesTo: 'xodim',
        writes: ['xodim'],
        reads: [],
        adminOnly: true,
        rpc: 'update_employee',
      },
      {
        id: 'parolni_tiklash',
        title: 'Parolni tiklash',
        appliesTo: 'xodim',
        writes: ['xodim'],
        reads: [],
        adminOnly: true,
        rpc: 'reset_employee_password',
      },
      {
        // The one PIN an employee has, whichever module's door they stand at.
        id: 'pin_ornatish',
        title: 'PIN belgilash',
        appliesTo: 'xodim',
        writes: ['xodim'],
        reads: [],
        adminOnly: true,
        rpc: 'admin_set_finance_pin',
      },
    ],
    nav: [
      {
        href: '/hub/settings',
        labelKey: 'nav.organization',
        icon: 'settings',
        groupKey: 'hub.settings',
        adminOnly: true,
      },
    ],
  },

  {
    id: 'moliya',
    titleKey: 'hub.finance',
    descriptionKey: 'hub.financeDescription',
    href: '/dashboard',
    icon: 'finance',
    purpose:
      'Kim kimga qancha qarzdor: mijozlar reestri va ularga qarshi yuritiladigan debet/kredit daftari. Qarz raqami shu yerda tug‘iladi — boshqa modul uni hisoblab chiqarmaydi, shu yerdan o‘qiydi.',
    // Only the manager on a client card: the ledger needs to know who looks
    // after whom, and nothing else from outside.
    reads: ['xodim'],
    hubGroupKey: 'hub.modules',
    gated: true,
    actions: [
      {
        id: 'mijoz_qoshish',
        title: 'Mijoz qo‘shish',
        appliesTo: 'kontragent',
        writes: ['kontragent'],
        reads: ['xodim'],
      },
      {
        id: 'mijozni_tahrirlash',
        title: 'Mijozni tahrirlash',
        appliesTo: 'kontragent',
        writes: ['kontragent'],
        reads: ['xodim'],
      },
      {
        // Nothing is destroyed and nothing is checked: the client leaves every
        // list and their entries stay where they are. What the screen shows
        // first is what is attached — Sotuv's invoices among them — but that
        // is not Moliya reading Sotuv, and `reads` is right to stay empty: the
        // arrow runs the other way. Sotuv depends on the client register, and
        // knowing what points at a row is what owning the register means. The
        // tables counted are checked against these very links in
        // ontology/schema.test.ts, so a new module that starts referencing
        // clients cannot quietly fall outside the warning.
        id: 'mijozni_arxivlash',
        title: 'Mijozni arxivga olish',
        appliesTo: 'kontragent',
        writes: ['kontragent'],
        reads: [],
        adminOnly: true,
        rpc: 'archive_counterparty',
      },
      {
        // The reason archiving needs no conditions.
        id: 'mijozni_tiklash',
        title: 'Mijozni arxivdan qaytarish',
        appliesTo: 'kontragent',
        writes: ['kontragent'],
        reads: [],
        adminOnly: true,
        rpc: 'restore_counterparty',
      },
      {
        id: 'tranzaksiya_kiritish',
        title: 'Tranzaksiya kiritish',
        appliesTo: 'kontragent',
        writes: ['tranzaksiya'],
        reads: ['kategoriya', 'hisob'],
      },
      {
        // Never a delete: a posted entry is cancelled by an opposite one, so
        // the trail stays readable. See 0014.
        id: 'tranzaksiyani_bekor_qilish',
        title: 'Tranzaksiyani bekor qilish',
        appliesTo: 'tranzaksiya',
        writes: ['tranzaksiya'],
        reads: [],
        rpc: 'reverse_transaction',
      },
      {
        id: 'davrni_yopish',
        title: 'Davrni yopish',
        appliesTo: 'davr',
        writes: ['davr'],
        reads: [],
        adminOnly: true,
        rpc: 'close_accounting_period',
      },
    ],
    nav: [
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'overview' },
      { href: '/clients', labelKey: 'nav.allClients', icon: 'clients' },
      {
        href: '/settings',
        labelKey: 'nav.settings',
        icon: 'settings',
        groupKey: 'hub.settings',
        adminOnly: true,
      },
    ],
  },

  {
    id: 'sklad',
    titleKey: 'hub.sklad',
    descriptionKey: 'hub.skladDescription',
    href: '/hub/sklad',
    icon: 'sklad',
    purpose:
      'Nima jismonan bor va sexlar unga nima qildi: mahsulot kartasi, partiya, qoldiq, buyurtma va bosqichlar. Tovar chiqimi bu yerda emas — chiqarish sotuvning oxirgi qadami, shuning uchun u Sotuvda.',
    reads: ['kontragent', 'xodim'],
    hubGroupKey: 'hub.modules',
    gated: true,
    actions: [
      {
        // The storekeeper types a paper invoice and the database parses it,
        // creating whatever reference values do not exist yet. No money: what
        // the goods are worth is set by the manager on the sales invoice.
        id: 'kirim_qilish',
        title: 'Kirim qilish',
        appliesTo: 'partiya',
        writes: ['partiya', 'mahsulot', 'spravochnik'],
        reads: [],
        rpc: 'sklad_receive_rows',
      },
      {
        // The only way the remainder moves. qoldiqDona is a trigger's sum of
        // these, so nothing writes the batch's stock figure directly — which
        // is why `writes` names harakat and not partiya.
        id: 'harakat_yozish',
        title: 'Ombor harakatini yozish',
        appliesTo: 'partiya',
        writes: ['harakat'],
        reads: ['kontragent', 'buyurtma'],
        rpc: 'record_sklad_movement',
      },
      {
        id: 'buyurtma_ochish',
        title: 'Buyurtma ochish',
        appliesTo: 'buyurtma',
        writes: ['buyurtma', 'buyurtma_qatori'],
        reads: ['kontragent', 'xodim', 'mahsulot'],
      },
      {
        id: 'bosqich_yozuvi_kiritish',
        title: 'Bosqich yozuvini kiritish',
        appliesTo: 'buyurtma_qatori',
        writes: ['bosqich_yozuvi'],
        reads: ['bosqich'],
      },
      {
        id: 'narx_belgilash',
        title: 'Narx belgilash',
        appliesTo: 'partiya',
        writes: ['narx'],
        reads: [],
        adminOnly: true,
      },
    ],
    nav: [
      {
        href: '/hub/sklad',
        labelKey: 'sklad.nav.overview',
        icon: 'overview',
        groupKey: 'hub.sklad',
      },
      {
        href: '/hub/sklad/orders',
        labelKey: 'sklad.nav.orders',
        icon: 'orders',
        groupKey: 'hub.sklad',
      },
      {
        href: '/hub/sklad/stock',
        labelKey: 'sklad.nav.stock',
        icon: 'sklad',
        groupKey: 'hub.sklad',
      },
      {
        href: '/hub/sklad/kirim',
        labelKey: 'sklad.nav.receiving',
        icon: 'inbound',
        groupKey: 'sklad.nav.operations',
      },
      {
        href: '/hub/sklad/settings',
        labelKey: 'sklad.nav.settings',
        icon: 'settings',
        groupKey: 'hub.settings',
        adminOnly: true,
      },
    ],
  },

  {
    id: 'sotuv',
    titleKey: 'hub.sotuv',
    descriptionKey: 'hub.sotuvDescription',
    href: '/hub/sotuv',
    icon: 'sales',
    purpose:
      'Menejer yozgan qog‘oz va uning ortidan ketgan tovar: faktura, qop, jo‘natma. Tovarni ombordan chiqarish shu yerda tugaydi, lekin chiqim yozuvini Sotuv o‘zi yozmaydi — Skladning harakat_yozish amalini chaqiradi.',
    reads: ['kontragent', 'xodim', 'buyurtma', 'buyurtma_qatori', 'mahsulot', 'partiya'],
    hubGroupKey: 'hub.modules',
    gated: true,
    actions: [
      {
        id: 'faktura_yozish',
        title: 'Faktura yozish',
        appliesTo: 'faktura',
        writes: ['faktura', 'faktura_qatori'],
        reads: ['kontragent', 'xodim', 'buyurtma', 'mahsulot', 'partiya'],
        rpc: 'sklad_create_invoice',
      },
      {
        // Packing rearranges goods, it does not consume them — a sack on the
        // floor is still stock. So this writes no movement at all.
        id: 'qoplash',
        title: 'Partiyani qoplash',
        appliesTo: 'partiya',
        writes: ['qop', 'qop_qatori'],
        reads: ['partiya', 'mahsulot', 'faktura'],
        rpc: 'sklad_pack_batch',
      },
      {
        id: 'qop_tahrirlash',
        title: 'Qop ichini tahrirlash',
        appliesTo: 'qop',
        writes: ['qop', 'qop_qatori'],
        reads: ['partiya', 'mahsulot'],
        rpc: 'sklad_save_package',
      },
      {
        // One code in, one answer out: the scanner does not know in advance
        // whether it is holding an invoice, a sack or a product.
        id: 'skanerlash',
        title: 'Skanerlash',
        appliesTo: 'faktura',
        writes: [],
        reads: ['faktura', 'qop', 'mahsulot', 'partiya'],
        rpc: 'sklad_scan',
      },
      {
        // The moment stock actually leaves. The despatch and its lines are
        // Sotuv's own; the write-off against each lot is Sklad's, and is asked
        // for rather than performed — mirroring sklad_issue_packages calling
        // record_sklad_movement.
        id: 'jonatish',
        title: 'Qoplarni jo‘natish',
        appliesTo: 'faktura',
        writes: ['jonatma', 'jonatma_qatori', 'qop'],
        reads: ['partiya', 'kontragent', 'buyurtma'],
        invokes: ['sklad.harakat_yozish'],
        rpc: 'sklad_issue_packages',
      },
      {
        // The older despatch path, straight off an order line. Its screen
        // still sits under /hub/sklad/orders/[id] — a Sklad page raising a
        // Sotuv document, which is the one place the rail and the ontology
        // disagree. The duty is Sotuv's; the screen has yet to move.
        id: 'buyurtmadan_jonatish',
        title: 'Buyurtmadan jo‘natish',
        appliesTo: 'buyurtma_qatori',
        writes: ['jonatma', 'jonatma_qatori'],
        reads: ['partiya', 'buyurtma_qatori', 'kontragent'],
        invokes: ['sklad.harakat_yozish'],
        rpc: 'sklad_issue_rows',
      },
    ],
    nav: [
      { href: '/hub/sotuv', labelKey: 'sotuv.clients', icon: 'clients', groupKey: 'hub.sotuv' },
      {
        href: '/hub/sotuv/faktura',
        labelKey: 'sklad.nav.invoices',
        icon: 'invoice',
        groupKey: 'hub.sotuv',
      },
      {
        href: '/hub/sotuv/skaner',
        labelKey: 'sotuv.scanTitle',
        icon: 'sklad',
        groupKey: 'sotuv.despatchGroup',
      },
      {
        href: '/hub/sotuv/chiqim',
        labelKey: 'sklad.nav.issuing',
        icon: 'outbound',
        groupKey: 'sotuv.despatchGroup',
      },
    ],
  },
] as const satisfies readonly OntologyModule[];
