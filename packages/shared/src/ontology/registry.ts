import type {
  ActionDef,
  LinkDef,
  ModuleDef,
  ModuleId,
  NavItemDef,
  ObjectTypeDef,
  PlatformScreenDef,
  PropertyDef,
} from './types';

export interface OntologyInput {
  modules: readonly ModuleDef[];
  objectTypes: readonly ObjectTypeDef[];
  links: readonly LinkDef[];
  /** Screens that belong to no one module because they are about all of them. */
  platformScreens?: readonly PlatformScreenDef[];
}

/**
 * The column a property is stored in, or null when it is not stored at all.
 *
 * The convention across the schema is the snake_case of the property, so the
 * declarations only have to say something where that is not true. A reader that
 * builds a select list uses this and skips the nulls; nothing else may guess.
 */
export function propertyColumn(property: PropertyDef): string | null {
  if (property.column !== undefined) return property.column;
  return property.id.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** The stored properties of an object, in declaration order. */
export function storedProperties(objectType: ObjectTypeDef): PropertyDef[] {
  return objectType.properties.filter((p) => propertyColumn(p) !== null);
}

/** The column one row is addressed by — `id` unless the object says otherwise. */
export function primaryKeyOf(objectType: ObjectTypeDef): string {
  return objectType.primaryKey ?? 'id';
}

/** An action with the module that publishes it, since actions are looked up
 * across modules and an id alone does not say whose it is. */
export interface OwnedAction extends ActionDef {
  module: ModuleId;
  /** `sklad.harakat_yozish` — unique across the ontology. */
  qualifiedId: string;
}

/**
 * A link as seen from one object: where it goes, what to call the walk, and —
 * the part a reader needs — which end holds the foreign key.
 *
 * That last one decides the query, and it is not the same question as
 * cardinality. A batch has at most one price, but the key is on the price
 * table, so finding it means selecting *from* prices by batch_id rather than
 * reading a column off the batch.
 */
export interface Traversal {
  link: LinkDef;
  /** True when this object is the `to` end and the traversal runs backwards. */
  reverse: boolean;
  target: ObjectTypeDef;
  title: string;
  /** How many land at the far end, counted from this side. */
  cardinality: LinkDef['cardinality'];
  /** Whether following it leaves the module that owns the source object. */
  crossesModule: boolean;
  /** The bare column name, without its table. */
  foreignKeyColumn: string;
  /**
   * True when the key sits on the source's own table: the target is fetched by
   * its primary key, using the value in that column. False means the target
   * table carries the key and is filtered by the source's id.
   */
  foreignKeyOnSource: boolean;
}

export interface NavGroupDef {
  /** i18n key; absent on the primary group, which needs no heading. */
  titleKey?: string;
  items: NavItemDef[];
}

/** A door on the hub: a module's front page, or a screen about all of them. */
export interface HubEntry {
  href: string;
  titleKey: string;
  descriptionKey?: string;
  icon: string;
}

export class OntologyError extends Error {
  constructor(readonly problems: string[]) {
    super(`Ontologiya qarama-qarshi:\n  - ${problems.join('\n  - ')}`);
    this.name = 'OntologyError';
  }
}

/**
 * Every way the declarations can contradict each other, found in one pass.
 *
 * Returned rather than thrown so the whole list can be read at once — fixing a
 * module boundary one error per build is how people give up on the boundary.
 * `buildOntology` is the one that refuses.
 */
export function validateOntology(input: OntologyInput): string[] {
  const problems: string[] = [];
  const { modules, objectTypes, links } = input;

  const moduleById = new Map(modules.map((m) => [m.id as string, m]));
  const objectById = new Map(objectTypes.map((o) => [o.id, o]));
  const tableToObject = new Map(objectTypes.map((o) => [o.table, o]));

  duplicates(modules.map((m) => m.id)).forEach((id) =>
    problems.push(`modul ikki marta e'lon qilingan: ${id}`),
  );
  duplicates(objectTypes.map((o) => o.id)).forEach((id) =>
    problems.push(`obyekt ikki marta e'lon qilingan: ${id}`),
  );
  duplicates(objectTypes.map((o) => o.table)).forEach((table) =>
    problems.push(`bitta jadvalga ikkita obyekt bog'langan: ${table}`),
  );
  duplicates(links.map((l) => l.id)).forEach((id) =>
    problems.push(`bog'lanish ikki marta e'lon qilingan: ${id}`),
  );

  // Ownership. The whole registry rests on this being exactly one module.
  for (const object of objectTypes) {
    if (!moduleById.has(object.owner)) {
      problems.push(`"${object.id}" obyektining egasi noma'lum modul: ${object.owner}`);
    }
    if (!object.properties.some((p) => p.id === object.titleProperty)) {
      problems.push(
        `"${object.id}" obyektining titleProperty'si o'zida yo'q: ${object.titleProperty}`,
      );
    }
    duplicates(object.properties.map((p) => p.id)).forEach((id) =>
      problems.push(`"${object.id}" obyektida xossa takrorlangan: ${id}`),
    );
  }

  // Links must land on declared objects, and the foreign key must sit on one
  // of the two tables — a link nobody can point at a column for is a wish.
  for (const link of links) {
    const from = objectById.get(link.from);
    const to = objectById.get(link.to);
    if (!from) problems.push(`"${link.id}" bog'lanishi noma'lum obyektdan chiqadi: ${link.from}`);
    if (!to) problems.push(`"${link.id}" bog'lanishi noma'lum obyektga boradi: ${link.to}`);
    if (!from || !to) continue;

    const table = link.foreignKey.split('.')[0];
    if (!table || !link.foreignKey.includes('.')) {
      problems.push(`"${link.id}" bog'lanishining foreignKey'si "jadval.ustun" ko'rinishida emas`);
      continue;
    }
    if (table !== from.table && table !== to.table) {
      problems.push(
        `"${link.id}" bog'lanishining kaliti ${table} jadvalida, lekin uchlari ${from.table} va ${to.table}`,
      );
    }
  }

  // What each module actually leans on, gathered from its own declarations, so
  // "declared but unused" and "used but undeclared" can both be reported.
  const usedForeign = new Map<string, Set<string>>(modules.map((m) => [m.id as string, new Set()]));

  function noteUse(moduleId: string, objectId: string) {
    const object = objectById.get(objectId);
    if (!object || object.owner === moduleId) return;
    usedForeign.get(moduleId)?.add(objectId);
  }

  // A foreign key is written by whoever owns the table it sits on: that module
  // has to resolve the object at the other end, so that is the dependency.
  for (const link of links) {
    const from = objectById.get(link.from);
    const to = objectById.get(link.to);
    if (!from || !to) continue;
    const table = link.foreignKey.split('.')[0];
    const holder = table ? tableToObject.get(table) : undefined;
    if (!holder) continue;
    const other = holder.id === from.id ? to : from;
    noteUse(holder.owner, other.id);
  }

  const actionIds = new Set<string>();
  for (const module of modules) {
    duplicates(module.actions.map((a) => a.id)).forEach((id) =>
      problems.push(`"${module.id}" modulida amal takrorlangan: ${id}`),
    );

    for (const action of module.actions) {
      actionIds.add(`${module.id}.${action.id}`);

      for (const objectId of [action.appliesTo, ...action.reads, ...action.writes]) {
        if (!objectById.has(objectId)) {
          problems.push(`"${module.id}.${action.id}" amali noma'lum obyektga tegadi: ${objectId}`);
        }
      }

      // The rule the boundary is made of.
      for (const objectId of action.writes) {
        const object = objectById.get(objectId);
        if (object && object.owner !== module.id) {
          problems.push(
            `"${module.id}.${action.id}" amali "${objectId}" obyektini yozmoqchi, lekin uning egasi "${object.owner}" — ` +
              `o'sha modulning amalini invokes orqali chaqiring`,
          );
        }
      }

      for (const objectId of [action.appliesTo, ...action.reads]) noteUse(module.id, objectId);
    }
  }

  for (const module of modules) {
    for (const objectId of module.reads) {
      const object = objectById.get(objectId);
      if (!object) {
        problems.push(`"${module.id}" moduli noma'lum obyektni o'qiydi: ${objectId}`);
        continue;
      }
      if (object.owner === module.id) {
        problems.push(
          `"${module.id}" moduli o'zining "${objectId}" obyektini reads'da sanagan — egalik obyektda yozilgan, bu yerda takrorlanmaydi`,
        );
      }
    }

    const declared = new Set<string>(module.reads);
    for (const objectId of usedForeign.get(module.id) ?? []) {
      if (!declared.has(objectId)) {
        const owner = objectById.get(objectId)?.owner;
        problems.push(
          `"${module.id}" moduli "${objectId}" (${owner}) obyektiga tayanadi, lekin uni reads'da e'lon qilmagan`,
        );
      }
    }
    for (const objectId of declared) {
      if (objectById.get(objectId) && !usedForeign.get(module.id)?.has(objectId)) {
        problems.push(
          `"${module.id}" moduli "${objectId}" obyektini reads'da sanagan, lekin hech qayerda ishlatmaydi`,
        );
      }
    }
  }

  // Cross-module calls: the only sanctioned way to change someone else's data.
  for (const module of modules) {
    for (const action of module.actions) {
      for (const target of action.invokes ?? []) {
        if (!actionIds.has(target)) {
          problems.push(`"${module.id}.${action.id}" mavjud bo'lmagan amalni chaqiradi: ${target}`);
          continue;
        }
        if (target.startsWith(`${module.id}.`)) {
          problems.push(
            `"${module.id}.${action.id}" o'z modulining amalini invokes orqali chaqirgan — invokes faqat modullar orasida`,
          );
        }
      }
    }
  }

  // One screen, one claimant. Two claims on a path means the rail contradicts
  // itself and whichever renders last wins, which is not a rule.
  const navOwners = new Map<string, string>();
  for (const module of modules) {
    for (const item of module.nav) {
      const existing = navOwners.get(item.href);
      if (existing) {
        problems.push(
          `"${item.href}" sahifasini ikkita modul da'vo qilyapti: ${existing}, ${module.id}`,
        );
      } else {
        navOwners.set(item.href, module.id);
      }
    }
  }
  for (const screen of input.platformScreens ?? []) {
    const existing = navOwners.get(screen.href);
    if (existing) {
      problems.push(
        `"${screen.href}" sahifasini ham modul, ham platforma ekrani da'vo qilyapti: ${existing}`,
      );
    } else {
      navOwners.set(screen.href, 'platform');
    }
  }

  problems.push(...findDependencyCycle(modules, objectById));

  return problems;
}

/**
 * The module dependency graph, and the first cycle in it if there is one.
 *
 * A cycle is not a style complaint: it means neither module can be understood,
 * tested or deployed without the other, and the next one added inherits both.
 * The layering is the product — Sotuv leans on Sklad leans on Moliya — so a
 * back-edge is a design mistake caught at the moment it is made.
 */
function findDependencyCycle(
  modules: readonly ModuleDef[],
  objectById: Map<string, ObjectTypeDef>,
): string[] {
  const edges = new Map<string, Set<string>>(modules.map((m) => [m.id as string, new Set()]));

  for (const module of modules) {
    const out = edges.get(module.id);
    if (!out) continue;
    for (const objectId of module.reads) {
      const owner = objectById.get(objectId)?.owner;
      if (owner && owner !== module.id) out.add(owner);
    }
    for (const action of module.actions) {
      for (const target of action.invokes ?? []) {
        const owner = target.split('.')[0];
        if (owner && owner !== module.id && edges.has(owner)) out.add(owner);
      }
    }
  }

  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const problems: string[] = [];

  function walk(id: string) {
    if (state.get(id) === 'done' || problems.length > 0) return;
    if (state.get(id) === 'visiting') {
      const cycle = stack.slice(stack.indexOf(id)).concat(id);
      problems.push(`modullar bir-biriga halqa bo'lib bog'langan: ${cycle.join(' -> ')}`);
      return;
    }
    state.set(id, 'visiting');
    stack.push(id);
    for (const next of edges.get(id) ?? []) walk(next);
    stack.pop();
    state.set(id, 'done');
  }

  for (const module of modules) walk(module.id);
  return problems;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

/**
 * The built ontology: the same declarations, indexed for the questions the
 * screens actually ask.
 */
export class Ontology {
  readonly modules: readonly ModuleDef[];
  readonly objectTypes: readonly ObjectTypeDef[];
  readonly links: readonly LinkDef[];
  readonly platformScreens: readonly PlatformScreenDef[];

  private readonly moduleIndex: Map<string, ModuleDef>;
  private readonly objectIndex: Map<string, ObjectTypeDef>;
  private readonly actionIndex: Map<string, OwnedAction>;

  constructor(input: OntologyInput) {
    const problems = validateOntology(input);
    if (problems.length > 0) throw new OntologyError(problems);

    this.modules = input.modules;
    this.objectTypes = input.objectTypes;
    this.links = input.links;
    this.platformScreens = input.platformScreens ?? [];
    this.moduleIndex = new Map(input.modules.map((m) => [m.id as string, m]));
    this.objectIndex = new Map(input.objectTypes.map((o) => [o.id, o]));
    this.actionIndex = new Map(
      input.modules.flatMap((m) =>
        m.actions.map((a): [string, OwnedAction] => [
          `${m.id}.${a.id}`,
          { ...a, module: m.id, qualifiedId: `${m.id}.${a.id}` },
        ]),
      ),
    );
  }

  module(id: string): ModuleDef | undefined {
    return this.moduleIndex.get(id);
  }

  objectType(id: string): ObjectTypeDef | undefined {
    return this.objectIndex.get(id);
  }

  action(qualifiedId: string): OwnedAction | undefined {
    return this.actionIndex.get(qualifiedId);
  }

  /** Which module is answerable for this object. */
  ownerOf(objectId: string): ModuleId | undefined {
    return this.objectIndex.get(objectId)?.owner;
  }

  objectsOwnedBy(moduleId: string): ObjectTypeDef[] {
    return this.objectTypes.filter((o) => o.owner === moduleId);
  }

  /** Everywhere this object can be walked to, in both directions. */
  traversalsFrom(objectId: string): Traversal[] {
    const source = this.objectIndex.get(objectId);
    if (!source) return [];

    const out: Traversal[] = [];
    for (const link of this.links) {
      const [keyTable = '', keyColumn = ''] = link.foreignKey.split('.');

      if (link.from === objectId) {
        const target = this.objectIndex.get(link.to);
        if (!target) continue;
        out.push({
          link,
          reverse: false,
          target,
          title: link.title,
          cardinality: link.cardinality,
          crossesModule: target.owner !== source.owner,
          foreignKeyColumn: keyColumn,
          foreignKeyOnSource: keyTable === source.table,
        });
      }
      if (link.to === objectId) {
        const target = this.objectIndex.get(link.from);
        if (!target) continue;
        out.push({
          link,
          reverse: true,
          target,
          title: link.inverse,
          // Walking back up a 'many' lands on exactly one row.
          cardinality: link.cardinality === 'many' ? 'one' : 'many',
          crossesModule: target.owner !== source.owner,
          foreignKeyColumn: keyColumn,
          foreignKeyOnSource: keyTable === source.table,
        });
      }
    }
    return out;
  }

  /** Every action that starts from this object, whichever module publishes it —
   * which is the point: the buttons on a partiya include Sotuv's "qoplash". */
  actionsOn(objectId: string): OwnedAction[] {
    return [...this.actionIndex.values()].filter((a) => a.appliesTo === objectId);
  }

  actionsOf(moduleId: string): OwnedAction[] {
    return [...this.actionIndex.values()].filter((a) => a.module === moduleId);
  }

  /** The modules this one leans on, directly. */
  dependenciesOf(moduleId: string): ModuleId[] {
    const module = this.moduleIndex.get(moduleId);
    if (!module) return [];
    const out = new Set<ModuleId>();
    for (const objectId of module.reads) {
      const owner = this.ownerOf(objectId);
      if (owner && owner !== moduleId) out.add(owner);
    }
    for (const action of module.actions) {
      for (const target of action.invokes ?? []) {
        const owner = this.actionIndex.get(target)?.module;
        if (owner && owner !== moduleId) out.add(owner);
      }
    }
    return [...out];
  }

  /** The modules that would notice if this one changed. */
  dependentsOf(moduleId: string): ModuleId[] {
    return this.modules
      .filter((m) => m.id !== moduleId && this.dependenciesOf(m.id).includes(moduleId as ModuleId))
      .map((m) => m.id);
  }

  /** Which module a path belongs to — the longest matching front door wins, so
   * /hub/sklad/orders is Sklad and not whatever else starts with /hub. */
  moduleForPath(pathname: string): ModuleDef | undefined {
    return this.modules
      .filter((m) => pathname === m.href || pathname.startsWith(`${m.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
  }

  /** Every door on the hub, modules first and platform screens after them. */
  hubEntries(options: { isOrgAdmin: boolean }): (HubEntry & { groupKey: string })[] {
    const fromModules = this.modules
      .filter((m) => !m.planned && (options.isOrgAdmin || !m.adminOnly))
      .map((m) => ({
        href: m.href,
        titleKey: m.titleKey,
        descriptionKey: m.descriptionKey,
        icon: m.icon,
        groupKey: m.hubGroupKey,
      }));

    const fromPlatform = this.platformScreens
      .filter((s) => options.isOrgAdmin || !s.adminOnly)
      .map((s) => ({
        href: s.href,
        titleKey: s.titleKey,
        descriptionKey: s.descriptionKey,
        icon: s.icon,
        groupKey: s.hubGroupKey,
      }));

    return [...fromModules, ...fromPlatform];
  }

  /** The hub rail: the business, not the screens. */
  hubGroups(options: { isOrgAdmin: boolean }): NavGroupDef[] {
    return groupNav(
      this.hubEntries(options).map((entry) => ({
        href: entry.href,
        labelKey: entry.titleKey,
        icon: entry.icon,
        groupKey: entry.groupKey,
      })),
      { isOrgAdmin: options.isOrgAdmin },
    );
  }

  /** One module's own rail. */
  navGroups(moduleId: string, options: { isOrgAdmin: boolean }): NavGroupDef[] {
    const module = this.moduleIndex.get(moduleId);
    if (!module) return [];
    return groupNav([...module.nav], options);
  }

  /** The front door's tiles: everything with a sentence explaining itself. */
  tiles(options: { isOrgAdmin: boolean }): HubEntry[] {
    return this.hubEntries(options).filter((entry) => entry.descriptionKey);
  }
}

/** Keeps declaration order and puts the unheaded group first, which is what a
 * rail reads as "the main thing here". */
function groupNav(items: NavItemDef[], options: { isOrgAdmin: boolean }): NavGroupDef[] {
  const groups: NavGroupDef[] = [];
  const byKey = new Map<string, NavGroupDef>();

  for (const item of items) {
    if (item.adminOnly && !options.isOrgAdmin) continue;
    const key = item.groupKey ?? '';
    let group = byKey.get(key);
    if (!group) {
      group = { titleKey: item.groupKey, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}

export function buildOntology(input: OntologyInput): Ontology {
  return new Ontology(input);
}
