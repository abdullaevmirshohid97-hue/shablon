/**
 * The ontology's meta-model: the vocabulary in which the business describes
 * itself, one level above the tables.
 *
 * The problem it solves is the one that appears at the third module. Sklad
 * knows what a partiya is, Sotuv knows what a faktura is, and both know what a
 * mijoz is — but each learned it separately, from a table name and a hook, so
 * "what is a mijoz" has three answers that agree only by luck. Adding a fourth
 * module means teaching it the same things a fourth time, and changing one
 * thing means finding every module that guessed at it.
 *
 * So the objects are declared once, each with exactly one module answerable for
 * writing it, and every module states which of the *other* modules' objects it
 * reads. That declaration is the contract: the registry refuses to build an
 * ontology where two modules own the same object, where a module writes an
 * object it does not own, or where it reads one it never declared. A new module
 * therefore joins by declaring its own duty and its dependencies, and either it
 * fits or the build says exactly where it does not.
 *
 * Nothing here knows about React, Supabase or Next.js on purpose: web, mobile
 * and desktop all read the same map.
 */

/**
 * The parts of the company. Deliberately a hand-written union rather than one
 * inferred from the manifests: adding a module is a decision, and this line is
 * where it is made. Everything else about the module is derived.
 */
export type ModuleId = 'tashkilot' | 'moliya' | 'sklad' | 'sotuv';

/**
 * What kind of value a property holds — enough for a screen to know how to
 * render and align it without asking the module that owns it.
 */
export type PropertyKind =
  | 'text'
  /** A code a human reads aloud or a scanner reads: kod, barcode, faktura raqami. */
  | 'code'
  | 'number'
  | 'quantity'
  | 'money'
  | 'date'
  | 'status'
  /** A foreign key. The link, not the number, is what a reader wants — see LinkDef. */
  | 'ref';

/** The units the floor actually counts in. */
export type Unit = 'kg' | 'dona' | 'nabor' | 'qop' | 'sm';

export interface PropertyDef {
  id: string;
  /** What the floor calls it — this is the label a screen prints. */
  title: string;
  kind: PropertyKind;
  unit?: Unit;
  /**
   * The column behind it. Omitted when it is the snake_case of the id, which
   * is the convention everywhere; `null` when the property is not on the table
   * at all — a total the database computes, a name joined in from elsewhere, a
   * figure an RPC returns. A generic reader selects the stored ones and leaves
   * the rest to whoever knows how to work them out.
   */
  column?: string | null;
  /**
   * Hidden from staff by row-level security, not by the UI. Recorded here so a
   * screen never promises a column the database will return null for, and so
   * an export can drop it rather than emit a column of blanks.
   */
  restricted?: boolean;
  /**
   * Written by a trigger or a generated column. An action that tries to set it
   * is a bug, and the ontology is where that is written down — see qoldiqDona,
   * which only moves when a movement is recorded.
   */
  derived?: boolean;
}

export type LinkCardinality = 'one' | 'many';

/**
 * A traversal between two objects, named from the reading side.
 *
 * `from` -> `to` with `cardinality`, carried by `foreignKey` on whichever table
 * holds it; `inverse` names the walk back. Cross-module links are the ones that
 * matter — a qop line pointing at a sklad partiya is Sotuv depending on Sklad,
 * and the registry reads exactly that out of these rows rather than trusting
 * anyone to keep a dependency list up to date by hand.
 */
export interface LinkDef {
  id: string;
  /** Reading direction: "Mijozning fakturalari". */
  title: string;
  from: string;
  to: string;
  cardinality: LinkCardinality;
  /** The column carrying it, qualified when it does not sit on `from`'s table. */
  foreignKey: string;
  /** The name of the walk back, so a screen can offer both directions. */
  inverse: string;
}

export interface ObjectTypeDef {
  id: string;
  title: string;
  plural: string;
  /**
   * The one module answerable for writing it. Everyone else reads, and must
   * say so in their manifest. There is no second owner and no shared ownership:
   * that is the rule the whole registry exists to enforce.
   */
  owner: ModuleId;
  /** The table behind it, so the map can be checked against the schema. */
  table: string;
  /**
   * The column that addresses one row. `id` almost everywhere, but not
   * everywhere: a price is keyed by the batch it belongs to, and an employee by
   * the user they are.
   */
  primaryKey?: string;
  /**
   * Whether the table carries `org_id`. True for all but two — the company row
   * is identified by its own id, and a profile is global to the platform. A
   * reader that filters on a column the table does not have gets an error, not
   * a wider result, so this has to be stated rather than assumed.
   */
  orgScoped?: boolean;
  /** Which property to show when one of these has to be named in one line. */
  titleProperty: string;
  properties: readonly PropertyDef[];
  /**
   * Where a single one opens, with `:id` standing in for its key. Absent while
   * an object has no page of its own — a fact worth being able to query rather
   * than discover by clicking.
   */
  href?: string;
}

/**
 * What a module lets someone do, named as the verb they would use.
 *
 * `writes` is the honest part: it may name only objects the acting module
 * owns. An action that needs to change someone else's object is not an action,
 * it is a request to that module — so it names that module's action in
 * `invokes` instead. This is how the modules fit together: despatching sacks
 * has to write off stock, but Sotuv does not touch a Sklad table for it, it
 * calls Sklad's `harakat_yozish`, exactly as sklad_issue_packages already
 * calls record_sklad_movement in the database.
 *
 * That one rule is what makes a new module additive. It declares what it owns,
 * what it reads, and whose actions it leans on; nothing already built has to
 * learn about it, and the registry refuses the arrangement if it does not add
 * up.
 */
export interface ActionDef {
  id: string;
  title: string;
  /**
   * The object the action starts from — where the button belongs. It may be
   * another module's object (packing starts from a partiya), which is why this
   * is not the same thing as ownership.
   */
  appliesTo: string;
  writes: readonly string[];
  reads: readonly string[];
  /** Other modules' actions this one calls, qualified: `sklad.harakat_yozish`. */
  invokes?: readonly string[];
  /** Owner/admin only, as opposed to anyone who can open the module. */
  adminOnly?: boolean;
  /** The database function behind it, when there is one. */
  rpc?: string;
}

export interface NavItemDef {
  href: string;
  /** i18n key, not a string: the rail is Uzbek and Russian at the same time. */
  labelKey: string;
  /** Resolved to a component by the app — shared holds no JSX. */
  icon: string;
  /** Grouped under a heading in the rail; the primary group has none. */
  groupKey?: string;
  adminOnly?: boolean;
}

/**
 * A screen that belongs to no one module because it is about all of them — the
 * object explorer being the case that forced it into existence.
 *
 * It is deliberately not a module: a module is a duty someone in the company
 * carries, and browsing the map is not one. Making it a module would mean
 * inventing an owner for it and declaring a dependency on every object in the
 * business, which would say something false about how the company works in
 * order to make a menu entry appear.
 */
export interface PlatformScreenDef {
  href: string;
  titleKey: string;
  descriptionKey?: string;
  icon: string;
  hubGroupKey: string;
  adminOnly?: boolean;
}

export interface ModuleDef {
  id: ModuleId;
  titleKey: string;
  descriptionKey?: string;
  /** The module's front door. */
  href: string;
  icon: string;
  /**
   * Its duty, in one sentence, in the terms the company uses. This is the line
   * that settles arguments about where a new screen belongs.
   */
  purpose: string;
  /**
   * Other modules' objects this one reads. Its own are derived from ownership —
   * declaring them here as well would be a second place to keep in step, and
   * the registry rejects it.
   */
  reads: readonly string[];
  actions: readonly ActionDef[];
  nav: readonly NavItemDef[];
  /** Which group of the hub rail its front door belongs to. */
  hubGroupKey: string;
  /** Sits behind the per-module employee gate (see ModuleAccessGate). */
  gated: boolean;
  /** Only owners and admins see it at all — it gets no tile on the front door. */
  adminOnly?: boolean;
  /** Declared and validated, but not yet shown on the hub. */
  planned?: boolean;
}
