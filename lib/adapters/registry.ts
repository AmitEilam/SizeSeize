/**
 * Public adapter API.
 * Prefer detectProductAvailability() for new code.
 */
export {
  detectProductAvailability,
  fetchProductAvailability,
  listAdapters,
} from "@/lib/adapters/detect";
export type {
  DetectionConfidence,
  DetectionStatus,
  PageContext,
  ProductAdapter,
  ProductAvailability,
  ProductDetectionResult,
} from "@/lib/adapters/types";
export { AdapterError } from "@/lib/adapters/types";
