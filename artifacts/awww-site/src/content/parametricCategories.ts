/**
 * Map Product ID (or SKU) -> Input Key -> Category Name
 * This allows you to separate parametric options into distinct sections per product.
 * Uncategorized options will fall under "Configuration".
 * 
 * Example:
 * export const PARAMETRIC_CATEGORIES_CONFIG: Record<string, Record<string, string>> = {
 *   "123": { "leg_style": "Dimensions", "width": "Dimensions", "finish": "Aesthetics" }
 * };
 */
export const PARAMETRIC_CATEGORIES_CONFIG: Record<string, Record<string, string>> = {};
