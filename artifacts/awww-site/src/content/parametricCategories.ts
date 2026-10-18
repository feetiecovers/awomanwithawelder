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
export const PARAMETRIC_CATEGORIES_CONFIG: Record<string, Record<string, string>> = {
  "AL-DBTB": {
    "measurement_muv0oqug_au8en": "Dimensions",
    "measurement_muv154by_fimwb": "Dimensions",
    "measurement_muv17mgh_0tjqn": "Dimensions",
    "measurement_muv1as0o_lcobd": "Dimensions",
  },
  "COF-TBL-CUST": {
    "measurement_mudoyh9v_ps3aq": "Table Dimensions",
    "measurement_mudp2wfg_jxm7o": "Table Dimensions",
    "measurement_mudp4vze_nte11": "Leg Styling",
  },
};
