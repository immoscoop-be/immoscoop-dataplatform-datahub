import { renderLog } from '@datahub/contracts/log';
import { LOG_CATALOGUE, type LogId } from '@datahub/contracts/log-catalogue';

/**
 * The Log IDs, from the Log Catalogue in @datahub/contracts. A Log Entry keeps the Log ID and its
 * parameters; the text is built only when it is read (DEC-SR-09, FR-SR-12).
 */
type LogIdAbout<About extends string> = { [Id in LogId]: (typeof LOG_CATALOGUE)[Id]['about'] extends About ? Id : never }[LogId];

/** The Log IDs that may stand in the Log of a Collection. */
export type CollectionLogId = LogIdAbout<'collection'>;

/** The Log IDs that may stand in the Log of a Resource. */
export type ResourceLogId = LogIdAbout<'resource'>;

/** The text of a Log Entry in English, for the routes that give it along with its Log ID and parameters. */
export function logText(logId: string, params: Record<string, string>): string {
  return renderLog(logId, params, 'en');
}
