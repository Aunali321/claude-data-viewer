import { writable, derived } from 'svelte/store';
import { db } from '$lib/db';
import type { ExportRecord, StoredConversation, FilterState } from '$lib/types';

// Current selected export
export const currentExportId = writable<string | null>(null);

// All loaded exports
export const exports = writable<ExportRecord[]>([]);

// Current filter state
export const filters = writable<FilterState>({
  search: '',
  hasAttachments: null,
  hasArtifacts: null,
  hasCode: null,
  showHidden: false,
  showEmpty: false,
  sortBy: 'date-desc'
});

// Sidebar collapsed state
export const sidebarCollapsed = writable(false);

// Loading states
export const isLoading = writable(false);
export const loadingMessage = writable('');

// Initialize stores from database
export async function initializeStores(): Promise<void> {
  isLoading.set(true);
  loadingMessage.set('Loading data...');
  
  try {
    const allExports = await db.exports.toArray();
    exports.set(allExports);
    
    // Select first export if available
    if (allExports.length > 0) {
      currentExportId.set(allExports[0].id);
    }
  } catch (error) {
    console.error('Failed to initialize stores:', error);
  } finally {
    isLoading.set(false);
    loadingMessage.set('');
  }
}

// Add a new export to the store
export function addExport(exportRecord: ExportRecord): void {
  exports.update(current => [...current, exportRecord]);
  currentExportId.set(exportRecord.id);
}

// Remove an export from the store
export function removeExport(exportId: string): void {
  exports.update(current => current.filter(e => e.id !== exportId));
  currentExportId.update(current => current === exportId ? null : current);
}

// Derived store for current export
export const currentExport = derived(
  [exports, currentExportId],
  ([$exports, $currentExportId]) => {
    if (!$currentExportId) return null;
    return $exports.find(e => e.id === $currentExportId) ?? null;
  }
);

// Reset filters
export function resetFilters(): void {
  filters.set({
    search: '',
    hasAttachments: null,
    hasArtifacts: null,
    hasCode: null,
    showHidden: false,
    showEmpty: false,
    sortBy: 'date-desc'
  });
}
