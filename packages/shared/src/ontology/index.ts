import { LINKS } from './links';
import { MODULES } from './modules';
import { OBJECT_TYPES } from './objects';
import { PLATFORM_SCREENS } from './screens';
import { buildOntology } from './registry';

export * from './types';
export * from './registry';
export { OBJECT_TYPES, type ObjectTypeId } from './objects';
export { LINKS, type LinkId } from './links';
export { MODULES } from './modules';
export { PLATFORM_SCREENS } from './screens';

/**
 * The company's ontology, built and checked once at import.
 *
 * Built eagerly on purpose: a contradiction between two modules should stop
 * the app at the first import in a test run, not on the screen where the two
 * of them finally meet. Everything that renders a rail, a tile or an object's
 * links reads this instead of holding its own copy of the answer.
 */
export const ontology = buildOntology({
  modules: MODULES,
  objectTypes: OBJECT_TYPES,
  links: LINKS,
  platformScreens: PLATFORM_SCREENS,
});
