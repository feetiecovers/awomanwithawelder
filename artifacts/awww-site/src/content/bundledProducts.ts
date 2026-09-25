/**
 * Map Product ID (or SKU) -> Function that returns background product IDs to add
 * This allows you to build a product that nests/sells other products in the background.
 * 
 * Example:
 * export const BUNDLED_PRODUCTS_CONFIG: Record<string, (payload: any) => number[]> = {
 *   "456": (payload) => payload.values["custom_axle"] === "yes" ? [789] : []
 * };
 */
export const BUNDLED_PRODUCTS_CONFIG: Record<string, (payload: any) => number[]> = {};
