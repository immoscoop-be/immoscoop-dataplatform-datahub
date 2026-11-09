/** Private: its Owner Unit and the Data Team see it. Public: every User does (DEC-CO-10). */
export type CollectionVisibility = 'private' | 'public';

/**
 * The icon of a Collection, required (DEC-CO-25): the name of any icon of Phosphor but the logos of
 * brands, drawn in the light weight (DEC-CO-19), such as `house-line`. A Collection has no colour
 * (DEC-CO-23). The list and its check are large, so they live apart, in
 * `@datahub/contracts/collection-icons`.
 */
export type CollectionIcon = string;
