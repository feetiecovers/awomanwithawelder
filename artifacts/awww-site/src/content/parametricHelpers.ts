/**
 * Configuration for Parametric Product Helper Bubbles.
 * 
 * Define definitions and images for:
 * 1. Category headers (e.g. "Dimensions", "Leg Styles", "Configuration")
 * 2. Specific option keys (e.g. "measurement_muv0oqug_au8en", "Front Width", etc.)
 * 
 * Key structure:
 * - Product ID (e.g. "9", "10", "11") or SKU (e.g. "AL-DBTB", "COF-TBL-CUST")
 * - Or "*" for universal helpers that show on any matching category or option across all products.
 */

export interface ParametricHelperEntry {
  title?: string;
  definition: string;
  image?: string;
  imageAlt?: string;
}

export interface ProductHelpersConfig {
  /** Helpers attached to category headers */
  categories?: Record<string, ParametricHelperEntry>;
  /** Helpers attached to individual input option fields */
  options?: Record<string, ParametricHelperEntry>;
}

export const PARAMETRIC_HELPERS_CONFIG: Record<string, ProductHelpersConfig> = {
  // Aluminium Drawbar Boxes (ID: 9 / SKU: "AL-DBTB")
  "AL-DBTB": {
    categories: {
      "Dimensions": {
        title: "Drawbar Box Sizing Guide",
        definition: "Measurements are taken from the outer edges. Make sure to allow clearance for your trailer winch post, tow ball coupling, and jockey wheel when tilting the lid open.",
        image: "/assets/helpers/drawbar_box_guide.jpg",
        imageAlt: "Drawbar toolbox schematic diagram with measurements",
      },
    },
    options: {
      "measurement_muv0oqug_au8en": {
        title: "Front Width (Taper)",
        definition: "Measured across the narrow front face pointing toward the vehicle tow coupling.",
      },
      "measurement_muv154by_fimwb": {
        title: "Rear Width",
        definition: "The wider back face that mounts flush against the trailer front wall or headboard.",
      },
      "measurement_muv17mgh_0tjqn": {
        title: "Box Length (Depth)",
        definition: "Horizontal depth from front face to rear face along the trailer drawbar tongue.",
      },
      "measurement_muv1as0o_lcobd": {
        title: "Box Height",
        definition: "Total vertical height from bottom mounting base to top of closed lid.",
      },
    },
  },

  // Coffee Tables (ID: 10 / SKU: "COF-TBL-CUST")
  "COF-TBL-CUST": {
    categories: {
      "Leg Styling": {
        title: "Leg Framework Options",
        definition: "Cross Legged features heavy-duty welded X-frame steel struts. Square Legged features clean modern box profile uprights.",
      },
    },
    options: {
      "measurement_mudp4vze_nte11": {
        title: "Leg Style Selection",
        definition: "Choose between Cross Legged welded steel industrial style or Square Legged modern profile tubing.",
      },
    },
  },

  // Universal helpers (applied to any product matching this category if not overridden)
  "*": {
    categories: {
      "Configuration": {
        title: "Parametric Customization",
        definition: "Adjust measurements within permitted limits. Pricing and fabrication capacity update dynamically in real time.",
      },
    },
  },
};

/**
 * Resolves helper entry for a category on a product
 */
export function getCategoryHelper(
  productIdOrSku: string | number | undefined,
  categoryName: string
): ParametricHelperEntry | null {
  if (!categoryName) return null;
  const pKey = productIdOrSku !== undefined ? String(productIdOrSku) : "";

  // 1. Check by specific SKU or ID
  const directConfig = PARAMETRIC_HELPERS_CONFIG[pKey];
  if (directConfig?.categories?.[categoryName]) {
    return directConfig.categories[categoryName];
  }

  // 2. Check universal "*"
  if (PARAMETRIC_HELPERS_CONFIG["*"]?.categories?.[categoryName]) {
    return PARAMETRIC_HELPERS_CONFIG["*"].categories[categoryName];
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
  fallbackBackend?: { helperTitle?: string; helperText?: string; helperImage?: string }
): ParametricHelperEntry | null {
  const pKey = productIdOrSku !== undefined ? String(productIdOrSku) : "";
  const directConfig = PARAMETRIC_HELPERS_CONFIG[pKey];

  // 1. Check specific product by option key or option label
  if (directConfig?.options?.[optionKey]) {
    return directConfig.options[optionKey];
  }
  if (optionLabel && directConfig?.options?.[optionLabel]) {
    return directConfig.options[optionLabel];
  }

  // 2. Check universal "*"
  if (PARAMETRIC_HELPERS_CONFIG["*"]?.options?.[optionKey]) {
    return PARAMETRIC_HELPERS_CONFIG["*"].options[optionKey];
  }
  if (optionLabel && PARAMETRIC_HELPERS_CONFIG["*"]?.options?.[optionLabel]) {
    return PARAMETRIC_HELPERS_CONFIG["*"].options[optionLabel];
  }

  // 3. Fallback to backend data if present
  if (fallbackBackend && (fallbackBackend.helperText || fallbackBackend.helperImage)) {
    return {
      title: fallbackBackend.helperTitle || optionLabel || optionKey,
      definition: fallbackBackend.helperText || "",
      image: fallbackBackend.helperImage,
    };
  }

  return null;
}
