import { describe, expect, it } from 'vitest';
import { LINKS } from './links';
import { MODULES } from './modules';
import { OBJECT_TYPES } from './objects';
import { OntologyError, buildOntology, validateOntology } from './registry';
import { ontology } from './index';
import type { LinkDef, ModuleDef, ObjectTypeDef } from './types';

/** The shipped declarations, as mutable copies a test can spoil one field of. */
function shipped() {
  return {
    modules: MODULES.map((m) => ({ ...m })) as unknown as ModuleDef[],
    objectTypes: OBJECT_TYPES.map((o) => ({ ...o })) as unknown as ObjectTypeDef[],
    links: LINKS.map((l) => ({ ...l })) as unknown as LinkDef[],
  };
}

describe('the shipped ontology', () => {
  it('has no contradictions', () => {
    expect(validateOntology(shipped())).toEqual([]);
  });

  it('gives every object exactly one owner', () => {
    const owned = MODULES.flatMap((m) => ontology.objectsOwnedBy(m.id).map((o) => o.id));
    expect(owned.length).toBe(OBJECT_TYPES.length);
    expect(new Set(owned).size).toBe(OBJECT_TYPES.length);
  });

  it('names a real table for every object', () => {
    for (const object of OBJECT_TYPES) {
      expect(object.table).toMatch(/^[a-z_]+$/);
    }
  });

  it('layers the modules without a cycle', () => {
    expect(ontology.dependenciesOf('tashkilot')).toEqual([]);
    expect(ontology.dependenciesOf('moliya')).toEqual(['tashkilot']);
    expect(ontology.dependenciesOf('sklad').sort()).toEqual(['moliya', 'tashkilot']);
    expect(ontology.dependenciesOf('sotuv').sort()).toEqual(['moliya', 'sklad', 'tashkilot']);
  });

  it('knows who would notice if the warehouse changed', () => {
    expect(ontology.dependentsOf('sklad')).toEqual(['sotuv']);
    expect(ontology.dependentsOf('sotuv')).toEqual([]);
  });
});

describe('walking the graph', () => {
  it('reaches a client from a lot on the warehouse floor', () => {
    // The question the floor actually asks: this lot went out — to whom. The
    // route is four links and touches all three modules, and nothing in the
    // registry hard-codes it.
    const hops = ['qop_qatori_partiyasi', 'qop_qatorlari', 'faktura_qoplari', 'faktura_mijozi'];
    let current = 'partiya';
    let crossings = 0;

    for (const linkId of hops) {
      const step = ontology.traversalsFrom(current).find((t) => t.link.id === linkId);
      expect(step, `${current} -> ${linkId}`).toBeDefined();
      if (step!.crossesModule) crossings += 1;
      current = step!.target.id;
    }

    expect(current).toBe('kontragent');
    expect(crossings).toBe(2);
  });

  it('walks a link backwards under its inverse name', () => {
    const back = ontology
      .traversalsFrom('partiya')
      .find((t) => t.link.id === 'mahsulot_partiyalari');
    expect(back?.reverse).toBe(true);
    expect(back?.target.id).toBe('mahsulot');
    // One lot belongs to one card, however many lots the card has.
    expect(back?.cardinality).toBe('one');
  });

  it('marks the traversals that leave the module', () => {
    const fromInvoiceLine = ontology.traversalsFrom('faktura_qatori');
    const toBatch = fromInvoiceLine.find((t) => t.target.id === 'partiya');
    const toInvoice = fromInvoiceLine.find((t) => t.target.id === 'faktura');
    expect(toBatch?.crossesModule).toBe(true);
    expect(toInvoice?.crossesModule).toBe(false);
  });

  it('offers another module’s action on the object it starts from', () => {
    // Packing is Sotuv's, but it begins on a Sklad batch — so the button
    // belongs on the batch, and the ontology is what says so.
    const onBatch = ontology.actionsOn('partiya');
    expect(onBatch.map((a) => a.qualifiedId)).toContain('sotuv.qoplash');
    expect(onBatch.map((a) => a.qualifiedId)).toContain('sklad.harakat_yozish');
  });

  it('routes despatch through the warehouse rather than around it', () => {
    const issue = ontology.action('sotuv.jonatish');
    expect(issue?.writes).not.toContain('harakat');
    expect(issue?.invokes).toContain('sklad.harakat_yozish');
    expect(ontology.action('sklad.harakat_yozish')?.writes).toContain('harakat');
  });
});

describe('the rails', () => {
  it('lists the business, not the screens', () => {
    const groups = ontology.hubGroups({ isOrgAdmin: false });
    const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toEqual(['/dashboard', '/hub/sklad', '/hub/sotuv']);
  });

  it('adds the settings door only for an admin', () => {
    const groups = ontology.hubGroups({ isOrgAdmin: true });
    const settings = groups.find((g) => g.titleKey === 'hub.settings');
    expect(settings?.items.map((i) => i.href)).toEqual(['/hub/settings']);
  });

  it('keeps a module’s own pages in that module’s rail', () => {
    const groups = ontology.navGroups('sklad', { isOrgAdmin: false });
    expect(groups[0]?.titleKey).toBe('hub.sklad');
    expect(groups[0]?.items.map((i) => i.href)).toEqual([
      '/hub/sklad',
      '/hub/sklad/orders',
      '/hub/sklad/stock',
    ]);
    expect(groups.some((g) => g.titleKey === 'hub.settings')).toBe(false);
  });

  it('answers which module a path belongs to, longest door first', () => {
    expect(ontology.moduleForPath('/hub/sklad/orders/abc')?.id).toBe('sklad');
    expect(ontology.moduleForPath('/hub/sotuv/faktura')?.id).toBe('sotuv');
    expect(ontology.moduleForPath('/hub/settings')?.id).toBe('tashkilot');
    expect(ontology.moduleForPath('/login')).toBeUndefined();
  });

  it('shows a tile for each part of the business a person walks into', () => {
    expect(ontology.tiles({ isOrgAdmin: true }).map((m) => m.id)).toEqual([
      'moliya',
      'sklad',
      'sotuv',
    ]);
  });
});

describe('the rules a new module has to satisfy', () => {
  it('refuses a module that writes another module’s object', () => {
    const input = shipped();
    const sotuv = input.modules.find((m) => m.id === 'sotuv')!;
    sotuv.actions = sotuv.actions.map((a) =>
      a.id === 'jonatish' ? { ...a, writes: [...a.writes, 'harakat'] } : a,
    );

    expect(validateOntology(input)).toContainEqual(expect.stringContaining('uning egasi "sklad"'));
  });

  it('refuses an undeclared dependency', () => {
    const input = shipped();
    const sklad = input.modules.find((m) => m.id === 'sklad')!;
    sklad.reads = sklad.reads.filter((id) => id !== 'kontragent');

    expect(validateOntology(input)).toContainEqual(
      expect.stringContaining('"kontragent" (moliya) obyektiga tayanadi'),
    );
  });

  it('refuses a dependency that is declared but never used', () => {
    const input = shipped();
    const moliya = input.modules.find((m) => m.id === 'moliya')!;
    moliya.reads = [...moliya.reads, 'qop'];

    expect(validateOntology(input)).toContainEqual(
      expect.stringContaining('"qop" obyektini reads\'da sanagan, lekin hech qayerda ishlatmaydi'),
    );
  });

  it('refuses ownership restated in a manifest', () => {
    const input = shipped();
    const sklad = input.modules.find((m) => m.id === 'sklad')!;
    sklad.reads = [...sklad.reads, 'partiya'];

    expect(validateOntology(input)).toContainEqual(
      expect.stringContaining('o\'zining "partiya" obyektini reads\'da sanagan'),
    );
  });

  it('refuses a call to an action nobody publishes', () => {
    const input = shipped();
    const sotuv = input.modules.find((m) => m.id === 'sotuv')!;
    sotuv.actions = sotuv.actions.map((a) =>
      a.id === 'jonatish' ? { ...a, invokes: ['sklad.tovarni_yoqotish'] } : a,
    );

    expect(validateOntology(input)).toContainEqual(
      expect.stringContaining("mavjud bo'lmagan amalni chaqiradi"),
    );
  });

  it('refuses two modules claiming one screen', () => {
    const input = shipped();
    const sklad = input.modules.find((m) => m.id === 'sklad')!;
    sklad.nav = [...sklad.nav, { href: '/hub/sotuv/faktura', labelKey: 'x', icon: 'invoice' }];

    expect(validateOntology(input)).toContainEqual(
      expect.stringContaining("ikkita modul da'vo qilyapti"),
    );
  });

  it('refuses a link whose foreign key is on neither table', () => {
    const input = shipped();
    input.links = input.links.map((l) =>
      l.id === 'faktura_mijozi' ? { ...l, foreignKey: 'sklad_batches.counterparty_id' } : l,
    );

    expect(validateOntology(input)).toContainEqual(
      expect.stringContaining('kaliti sklad_batches jadvalida'),
    );
  });

  it('refuses a link to an object nobody declared', () => {
    const input = shipped();
    input.links = [
      ...input.links,
      {
        id: 'xayoliy',
        title: 'Xayoliy',
        from: 'faktura',
        to: 'transport',
        cardinality: 'one',
        foreignKey: 'sklad_invoices.transport_id',
        inverse: 'Fakturalari',
      },
    ];

    expect(validateOntology(input)).toContainEqual(
      expect.stringContaining("noma'lum obyektga boradi: transport"),
    );
  });

  it('refuses a cycle between modules', () => {
    const input = shipped();
    // Give Sklad a reason to depend on Sotuv, closing the loop the layering
    // exists to prevent.
    const sklad = input.modules.find((m) => m.id === 'sklad')!;
    sklad.reads = [...sklad.reads, 'faktura'];
    sklad.actions = [
      ...sklad.actions,
      {
        id: 'fakturani_korish',
        title: 'Fakturani ko‘rish',
        appliesTo: 'faktura',
        writes: [],
        reads: ['faktura'],
      },
    ];

    expect(validateOntology(input)).toContainEqual(
      expect.stringContaining("halqa bo'lib bog'langan"),
    );
  });

  it('reports every problem at once rather than the first', () => {
    const input = shipped();
    const sotuv = input.modules.find((m) => m.id === 'sotuv')!;
    sotuv.reads = [];

    const problems = validateOntology(input);
    expect(problems.length).toBeGreaterThan(3);
  });

  it('refuses to build at all when something contradicts', () => {
    const input = shipped();
    input.objectTypes = input.objectTypes.map((o) =>
      o.id === 'qop' ? { ...o, owner: 'transport' as ModuleDef['id'] } : o,
    );

    expect(() => buildOntology(input)).toThrow(OntologyError);
  });
});
