/** Event intro scenes, keyed by events.json `scene`. Each is its own chunk: a page downloads only its scene. */
import type { EventBuilder } from '../eventScene';

export const eventScenes: Record<string, () => Promise<EventBuilder>> = {
  arcade: async () => (await import('./arcade')).buildArcade,
  sprint: async () => (await import('./sprint')).buildSprint,
  glance: async () => (await import('./glance')).buildGlance,
  canvas: async () => (await import('./canvas')).buildCanvas,
};
