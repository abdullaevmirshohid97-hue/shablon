import type { PlatformScreenDef } from './types';

/**
 * Screens that sit above the modules rather than inside one.
 *
 * Two so far, and both earned the category rather than being given it: the
 * object explorer reads every object in the business, so making it a module
 * would have meant inventing a duty nobody carries and declaring a dependency
 * on all four of the others — a false sentence about how the company works,
 * written to make a menu entry appear.
 *
 * The director's view is the same shape one level up. It reads across
 * organizations, which no module can do: a module belongs to a business, and
 * this screen exists precisely because someone owns several. It owns no
 * objects and carries no duty of its own — it watches the ones that do.
 */
export const PLATFORM_SCREENS = [
  {
    href: '/hub/obyekt',
    titleKey: 'ontology.title',
    descriptionKey: 'ontology.description',
    icon: 'graph',
    hubGroupKey: 'hub.modules',
  },
  {
    href: '/direktor',
    titleKey: 'director.title',
    descriptionKey: 'director.description',
    icon: 'shield',
    hubGroupKey: 'hub.modules',
    adminOnly: true,
  },
] as const satisfies readonly PlatformScreenDef[];
