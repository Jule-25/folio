/** Rows a table or list shows before "Load more", when its view sets none
 *  (Layout › Load limit). 0 in a view means all of them. */
export const DEFAULT_LOAD_LIMIT = 50;

/** The choices in Layout › Load limit. */
export const LOAD_LIMIT_OPTIONS = [10, 25, 50, 100, 0] as const;
