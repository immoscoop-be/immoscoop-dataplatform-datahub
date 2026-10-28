/**
 * The Log Catalogue: every kind of Log Entry, by its fixed Log ID, with its parameters and its
 * template in Dutch and English (DEC-SR-09, FR-SR-12, NFR-LOC-10). A Log Entry keeps only its Log ID
 * and parameters; its text is built when it is read, in the language of the reader. The page
 * docs/requirements/functional/log-catalogue.md is generated from this file (`pnpm docs:build`).
 *
 * Like the Message Catalogue, this file imports nothing at run time, so that `scripts/log-catalogue.ts`
 * can import it as it is, with Node.js. The templates take the same placeholders as the texts of a
 * Message: `{name}`, and `{name, select, …}` to choose words. A name is never translated (NFR-LOC-01).
 */

import type { Language } from './messages.js';

/** What the Log of an entry belongs to. */
export type LogSubject = 'resource' | 'collection' | 'output';

export interface LogType {
  readonly about: LogSubject;
  readonly parameters: readonly string[];
  readonly text: Readonly<Record<Language, string>>;
}

/** Every Log ID, in the order of the catalogue. */
export const LOG_CATALOGUE = {
  'RES-001': {
    about: 'resource',
    parameters: ['exposure', 'key', 'run'],
    text: { en: 'Registered through exposure {exposure}', nl: 'Geregistreerd via de exposure {exposure}' },
  },
  'RES-002': {
    about: 'resource',
    parameters: ['level', 'reason'],
    text: { en: 'Maturity assessed at Level {level}', nl: 'Maturiteit beoordeeld op Level {level}' },
  },
  'RES-003': {
    about: 'resource',
    parameters: ['old', 'new', 'run'],
    text: { en: 'Renamed from {old} to {new}', nl: 'Hernoemd van {old} naar {new}' },
  },
  'RES-004': {
    about: 'resource',
    parameters: ['run'],
    text: {
      en: 'Withdrawn: no exposure with the tag datahub depends on it any more',
      nl: 'Teruggetrokken: geen exposure met de tag datahub hangt er nog van af',
    },
  },
  'RES-005': {
    about: 'resource',
    parameters: ['field', 'actor'],
    text: {
      en: '{field, select, businessDescription {Business Description} intendedUse {Intended use} pitfalls {Pitfalls} knownGaps {Known Gaps} reliableSince {Reliable since} keyFields {Key fields} parameters {Parameters} other {{field}}} updated by {actor}',
      nl: '{field, select, businessDescription {Business Description} intendedUse {Beoogd gebruik} pitfalls {Valkuilen} knownGaps {Known Gaps} reliableSince {Betrouwbaar sinds} keyFields {Sleutelvelden} parameters {Parameters} other {{field}}} bijgewerkt door {actor}',
    },
  },
  'RES-006': {
    about: 'resource',
    parameters: ['exposure', 'run'],
    text: { en: 'Back through exposure {exposure}', nl: 'Terug via de exposure {exposure}' },
  },
  'RES-007': {
    about: 'resource',
    parameters: ['actor', 'reason'],
    text: { en: 'Marked deprecated by {actor}', nl: 'Als deprecated gemarkeerd door {actor}' },
  },
  'RES-008': {
    about: 'resource',
    parameters: ['actor'],
    text: { en: 'Deprecation taken away by {actor}', nl: 'Deprecated weggenomen door {actor}' },
  },
  'RES-009': {
    about: 'resource',
    parameters: ['mapped', 'fields', 'grain', 'modelType', 'release', 'actor'],
    text: {
      en: 'Grain and mappings recorded by {actor}: {mapped} of {fields} fields mapped',
      nl: 'Grain en mappings vastgelegd door {actor}: {mapped} van de {fields} velden gemapt',
    },
  },
  'RES-010': {
    about: 'resource',
    parameters: ['field', 'actor'],
    text: {
      en: 'Business Description of the field {field} updated by {actor}',
      nl: 'Business Description van het veld {field} bijgewerkt door {actor}',
    },
  },
  'COL-001': {
    about: 'collection',
    parameters: ['actor', 'name', 'ownerUnit', 'visibility'],
    text: { en: 'Collection created by {actor}', nl: 'Collection aangemaakt door {actor}' },
  },
  'COL-002': {
    about: 'collection',
    parameters: ['field', 'old', 'new', 'actor'],
    text: {
      en: '{field, select, name {Name} description {Description} icon {Icon} other {{field}}} changed by {actor}',
      nl: '{field, select, name {Naam} description {Beschrijving} icon {Icoon} other {{field}}} gewijzigd door {actor}',
    },
  },
  'COL-003': {
    about: 'collection',
    parameters: ['old', 'new', 'actor'],
    text: { en: 'Owner Unit changed from {old} to {new} by {actor}', nl: 'Owner Unit gewijzigd van {old} naar {new} door {actor}' },
  },
  'COL-004': {
    about: 'collection',
    parameters: ['visibility', 'actor'],
    text: {
      en: 'Made {visibility, select, public {public} other {private}} by {actor}',
      nl: '{visibility, select, public {Publiek} other {Privé}} gemaakt door {actor}',
    },
  },
  'COL-005': {
    about: 'collection',
    parameters: ['actor'],
    text: { en: 'Collection dissolved by {actor}', nl: 'Collection opgeheven door {actor}' },
  },
  'COL-006': {
    about: 'collection',
    parameters: ['resource', 'actor'],
    text: { en: '{resource} added by {actor}', nl: '{resource} toegevoegd door {actor}' },
  },
  'COL-007': {
    about: 'collection',
    parameters: ['resource', 'actor'],
    text: { en: '{resource} removed by {actor}', nl: '{resource} verwijderd door {actor}' },
  },
  'COL-030': {
    about: 'resource',
    parameters: ['collection', 'actor'],
    text: { en: 'Added to the Collection {collection} by {actor}', nl: 'Toegevoegd aan de Collection {collection} door {actor}' },
  },
  'COL-031': {
    about: 'resource',
    parameters: ['collection', 'actor'],
    text: { en: 'Removed from the Collection {collection} by {actor}', nl: 'Verwijderd uit de Collection {collection} door {actor}' },
  },
  'ART-010': {
    about: 'resource',
    parameters: ['field', 'direction', 'sourceNode', 'distance'],
    text: {
      en: 'Structural change: field {field} {direction, select, added {added} removed {removed} other {changed}}',
      nl: 'Structurele wijziging: veld {field} {direction, select, added {toegevoegd} removed {verwijderd} other {gewijzigd}}',
    },
  },
  'ART-011': {
    about: 'resource',
    parameters: ['sourceNode', 'distance'],
    text: { en: 'Logic change in {sourceNode}', nl: 'Wijziging van de logica in {sourceNode}' },
  },
  'ART-012': {
    about: 'resource',
    parameters: ['field', 'old', 'new', 'sourceNode', 'distance'],
    text: { en: 'Type of {field} changed from {old} to {new}', nl: 'Type van {field} gewijzigd van {old} naar {new}' },
  },
  'ART-013': {
    about: 'resource',
    parameters: ['sourceNode', 'distance'],
    text: { en: 'Description changed in {sourceNode}', nl: 'Beschrijving gewijzigd in {sourceNode}' },
  },
  'MAT-020': {
    about: 'resource',
    parameters: ['owner', 'fingerprint'],
    text: { en: 'Confirmed by {owner}', nl: 'Bevestigd door {owner}' },
  },
  'MAT-021': {
    about: 'resource',
    parameters: ['level', 'reason'],
    text: { en: 'Maturity dropped to Level {level}; the Owner was alerted', nl: 'Maturiteit gedaald naar Level {level}; de Owner is verwittigd' },
  },
  'MAT-022': {
    about: 'resource',
    parameters: ['actor', 'changes'],
    text: {
      en: 'Changes since the last Confirmation marked seen by {actor}',
      nl: 'Changes sinds de laatste Confirmation als gezien gemarkeerd door {actor}',
    },
  },
  'PUB-040': {
    about: 'resource',
    parameters: ['owner', 'level'],
    text: { en: 'Published by {owner}', nl: 'Gepubliceerd door {owner}' },
  },
  'CNV-050': {
    about: 'resource',
    parameters: ['actor', 'conversation'],
    text: { en: 'Signal raised by {actor}', nl: 'Signal gemeld door {actor}' },
  },
  'CNV-051': {
    about: 'resource',
    parameters: ['actor', 'conversation', 'anomaly'],
    text: { en: 'Signal turned into an Anomaly by {actor}', nl: 'Signal omgezet in een Anomaly door {actor}' },
  },
  'BRK-001': {
    about: 'output',
    parameters: ['missing', 'run'],
    text: { en: 'Broken: {missing} no longer exists', nl: 'Broken: {missing} bestaat niet meer' },
  },
  'BRK-002': {
    about: 'output',
    parameters: ['restored', 'run'],
    text: { en: 'Works again: {restored} exists again', nl: 'Werkt weer: {restored} bestaat weer' },
  },
} as const satisfies Record<string, LogType>;

export type LogId = keyof typeof LOG_CATALOGUE;

export function isLogId(value: string): value is LogId {
  return Object.hasOwn(LOG_CATALOGUE, value);
}
