/**
 * Configuration for Parametric Product Helper Bubbles.
 * 
 * Define definitions and images for:
 * 1. Category headers (e.g. "Dimensions", "Table Dimensions", "Configuration")
 * 2. Specific option keys (if needed)
 * 
 * Note: Helpers are limited to 1 per product for clean, non-cluttered UI.
 */

export interface ParametricHelperEntry {
  title?: string;
  definition: string;
  image?: string;
  imageAlt?: string;
}

export interface ProductHelpersConfig {
  /** Helpers attached to category headers (recommended: 1 per product) */
  categories?: Record<string, ParametricHelperEntry>;
  /** Helpers attached to individual input option fields */
  options?: Record<string, ParametricHelperEntry>;
}

// Drawbar Box Helper Definition (Single category helper for the product)
const DRAWBAR_BOX_HELPERS: ProductHelpersConfig = {
  categories: {
    "Dimensions": {
      title: "Drawbar Box Sizing Guide",
      definition: "Measurements are taken from the outer edges. Make sure to allow clearance for your trailer winch post, tow ball coupling, and jockey wheel when tilting the lid open.",
      image: "/assets/helpers/drawbar_box_guide.jpg",
      imageAlt: "Drawbar toolbox schematic diagram with measurements",
    },
  },
};

// Coffee Table Helper Definition (Single category helper with 2D pencil sketch)
const COFFEE_TABLE_HELPERS: ProductHelpersConfig = {
  categories: {
    "Table Dimensions": {
      title: "Table Dimensions Guide",
      definition: "The Coffee Tables parametric options are the length and width of the table top and the visual style of the legs.",
      image: "/assets/helpers/coffee_table_sketch.jpg",
      imageAlt: "Pencil sketch of coffee table top rectangle with length and width dimension arrows",
    },
    "Dimensions": {
      title: "Table Dimensions Guide",
      definition: "The Coffee Tables parametric options are the length and width of the table top and the visual style of the legs.",
      image: "/assets/helpers/coffee_table_sketch.jpg",
      imageAlt: "Pencil sketch of coffee table top rectangle with length and width dimension arrows",
    },
  },
};

export const PARAMETRIC_HELPERS_CONFIG: Record<string, ProductHelpersConfig> = {
  // Aluminium Drawbar Boxes (ID: 9 / SKU: "AL-DBTB")
  "AL-DBTB": DRAWBAR_BOX_HELPERS,
  "9": DRAWBAR_BOX_HELPERS,

  // Coffee Tables (ID: 10 / SKU: "COF-TBL-CUST")
  "COF-TBL-CUST": COFFEE_TABLE_HELPERS,
  "10": COFFEE_TABLE_HELPERS,
};

/**
 * Resolves helper entry for a category on a product
 */
export function getCategoryHelper(
  productIdOrSku: string | number | undefined,
  categoryName: string,
  alternateIdOrSku?: string | number | undefined
): ParametricHelperEntry | null {
  if (!categoryName) return null;
  const keys = [
    productIdOrSku !== undefined ? String(productIdOrSku) : "",
    alternateIdOrSku !== undefined ? String(alternateIdOrSku) : "",
  ].filter(Boolean);

  // Check by specific SKU or ID
  for (const key of keys) {
    const directConfig = PARAMETRIC_HELPERS_CONFIG[key];
    if (directConfig?.categories?.[categoryName]) {
      return directConfig.categories[categoryName];
    }
  }

  return null;
}

/**
 * Resolves helper entry for an individual option/field on a product
 */
export function getOptionHelper(
  productIdOrSku: string | number | undefined,
  optionKey: string,
  optionLabel?: string,
  fallbackBackend?: { helperTitle?: string; helperText?: string; helperImage?: string },
  alternateIdOrSku?: string | number | undefined
): ParametricHelperEntry | null {
  const keys = [
    productIdOrSku !== undefined ? String(productIdOrSku) : "",
    alternateIdOrSku !== undefined ? String(alternateIdOrSku) : "",
  ].filter(Boolean);

  // 1. Check specific product by option key or option label
  for (const key of keys) {
    const directConfig = PARAMETRIC_HELPERS_CONFIG[key];
    if (directConfig?.options?.[optionKey]) {
      return directConfig.options[optionKey];
    }
    if (optionLabel && directConfig?.options?.[optionLabel]) {
      return directConfig.options[optionLabel];
    }
  }

  // 2. Fallback to backend data if present
  if (fallbackBackend && (fallbackBackend.helperText || fallbackBackend.helperImage)) {
    return {
      title: fallbackBackend.helperTitle || optionLabel || optionKey,
      definition: fallbackBackend.helperText || "",
      image: fallbackBackend.helperImage,
    };
  }

  return null;
}
