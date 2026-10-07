/** Typed access to the content files. Components never hardcode copy: it all comes from src/content. */
import siteJson from '../content/site.json';
import eventsJson from '../content/events.json';

export type Theme = 'base' | 'thon' | 'blitz' | 'folio' | 'lab';

export interface EventStep {
  label: string;
  title: string;
  text: string;
  progress?: number;
  boss?: boolean;
}

export interface EventEntry {
  id: string;
  slug: string;
  number: string;
  theme: Theme;
  scene: string;
  name: string;
  orbit: string;
  title: string[];
  outline: number;
  serif: number;
  kicker: string;
  slate: string;
  tags: string[];
  card: string;
  tagline: string;
  description: string;
  stepsStyle: 'levels' | 'phases' | 'stages' | 'topics';
  steps: EventStep[];
  facts: { label: string; value: string }[];
  ticker?: string;
  cta: string;
  registerUrl: string;
}

export const site = siteJson;
export const events = eventsJson.events as EventEntry[];
export const eventHref = (e: EventEntry) => `/events/${e.slug}`;
/** Class for one line of an event title (outline / italic serif / plain). */
export const lineClass = (e: EventEntry, i: number) => (i === e.outline ? 'outline' : i === e.serif ? 'serif' : undefined);
