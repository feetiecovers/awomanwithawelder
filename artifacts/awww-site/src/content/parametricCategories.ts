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

const COFFEE_TABLE_CATEGORIES = {
  "measurement_mudoyh9v_ps3aq": "Table Dimensions",
  "measurement_mudp2wfg_jxm7o": "Table Dimensions",
  "measurement_mudp4vze_nte11": "Leg Styling",
};

const DRAWBAR_BOX_CATEGORIES = {
  "measurement_muv0oqug_au8en": "Dimensions",
  "measurement_muv154by_fimwb": "Dimensions",
  "measurement_muv17mgh_0tjqn": "Dimensions",
  "measurement_muv1as0o_lcobd": "Dimensions",
};

export const PARAMETRIC_CATEGORIES_CONFIG: Record<string, Record<string, string>> = {
  // Aluminium Drawbar Boxes (ID 9 / SKU "AL-DBTB")
  "AL-DBTB": DRAWBAR_BOX_CATEGORIES,
  "9": DRAWBAR_BOX_CATEGORIES,

  // Coffee Tables (ID 10 / SKU "COF-TBL-CUST")
  "COF-TBL-CUST": COFFEE_TABLE_CATEGORIES,
  "10": COFFEE_TABLE_CATEGORIES,
};
