import { ref } from "vue";

/**
 * Singleton-ish boolean that drives <RouteLoader>. Toggled by the
 * router.beforeEach guard in main.ts when a navigation needs to wait
 * for its image bundle to decode, and read by the overlay component.
 *
 * Kept module-level (not in a Pinia store) because it's a pure UI flag
 * with no persistence, no devtools value, and a single writer.
 */
const isLoading = ref(false);

export function useRouteLoader() {
  return { isLoading };
}
