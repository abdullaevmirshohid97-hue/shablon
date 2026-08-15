import type { PlatformScreenDef } from './types';

/**
 * Screens that sit above the modules rather than inside one.
 *
 * There is exactly one so far, and it earned the category rather than being
 * given it: the object explorer reads every object in the business, so making
 * it a module would have meant inventing a duty nobody carries and declaring a
 * dependency on all four of the others — a false sentence about how the
 * company works, written to make a menu entry appear.
 */
export const PLATFORM_SCREENS = [
  {
    href: '/hub/obyekt',
    titleKey: 'ontology.title',
    descriptionKey: 'ontology.description',
    icon: 'graph',
    hubGroupKey: 'hub.modules',
  },
] as const satisfies readonly PlatformScreenDef[];
