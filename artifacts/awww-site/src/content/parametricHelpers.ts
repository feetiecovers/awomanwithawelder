/**
 * Configuration for Parametric Product Helper Bubbles.
 * 
 * Define definitions and images for:
 * 1. Category headers (e.g. "Dimensions", "Table Dimensions", "Leg Styling", "Configuration")
 * 2. Specific option keys (e.g. "measurement_mudoyh9v_ps3aq", "Table Length", etc.)
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

// Drawbar Box Helper Definition
const DRAWBAR_BOX_HELPERS: ProductHelpersConfig = {
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
    "Front Width": {
      title: "Front Width (Taper)",
      definition: "Measured across the narrow front face pointing toward the vehicle tow coupling.",
    },
    "measurement_muv154by_fimwb": {
      title: "Rear Width",
      definition: "The wider back face that mounts flush against the trailer front wall or headboard.",
    },
    "Rear Width": {
      title: "Rear Width",
      definition: "The wider back face that mounts flush against the trailer front wall or headboard.",
    },
    "measurement_muv17mgh_0tjqn": {
      title: "Box Length (Depth)",
      definition: "Horizontal depth from front face to rear face along the trailer drawbar tongue.",
    },
    "Box Length (Front to Back)": {
      title: "Box Length (Depth)",
      definition: "Horizontal depth from front face to rear face along the trailer drawbar tongue.",
    },
    "measurement_muv1as0o_lcobd": {
      title: "Box Height",
      definition: "Total vertical height from bottom mounting base to top of closed lid.",
    },
    "Box Height": {
      title: "Box Height",
      definition: "Total vertical height from bottom mounting base to top of closed lid.",
    },
  },
};

// Coffee Table Helper Definition (2D Pencil Sketch Plan View)
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
    "Leg Styling": {
      title: "Leg Framework Options",
      definition: "Cross Legged features heavy-duty welded X-frame steel struts. Square Legged features clean modern box profile uprights.",
    },
  },
  options: {
    "measurement_mudoyh9v_ps3aq": {
      title: "Table Length",
      definition: "Adjusts the longer horizontal side of the tabletop rectangle shown in the sketch.",
      image: "/assets/helpers/coffee_table_sketch.jpg",
      imageAlt: "Table Length dimension arrow on pencil sketch",
    },
    "Table Length": {
      title: "Table Length",
      definition: "Adjusts the longer horizontal side of the tabletop rectangle shown in the sketch.",
      image: "/assets/helpers/coffee_table_sketch.jpg",
      imageAlt: "Table Length dimension arrow on pencil sketch",
    },
    "measurement_mudp2wfg_jxm7o": {
      title: "Table Width",
      definition: "Adjusts the shorter vertical side of the tabletop rectangle shown in the sketch.",
      image: "/assets/helpers/coffee_table_sketch.jpg",
      imageAlt: "Table Width dimension arrow on pencil sketch",
    },
    "Table Width": {
      title: "Table Width",
      definition: "Adjusts the shorter vertical side of the tabletop rectangle shown in the sketch.",
      image: "/assets/helpers/coffee_table_sketch.jpg",
      imageAlt: "Table Width dimension arrow on pencil sketch",
    },
    "measurement_mudp4vze_nte11": {
      title: "Leg Style Selection",
      definition: "Choose between Cross Legged welded steel industrial style or Square Legged modern profile tubing.",
    },
    "Leg Style": {
      title: "Leg Style Selection",
      definition: "Choose between Cross Legged welded steel industrial style or Square Legged modern profile tubing.",
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
  categoryName: string,
  alternateIdOrSku?: string | number | undefined
): ParametricHelperEntry | null {
  if (!categoryName) return null;
  const keys = [
    productIdOrSku !== undefined ? String(productIdOrSku) : "",
    alternateIdOrSku !== undefined ? String(alternateIdOrSku) : "",
  ].filter(Boolean);

  // 1. Check by specific SKU or ID
  for (const key of keys) {
    const directConfig = PARAMETRIC_HELPERS_CONFIG[key];
    if (directConfig?.categories?.[categoryName]) {
      return directConfig.categories[categoryName];
    }
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
