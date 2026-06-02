import { writable } from 'svelte/store';
import { db } from '$lib/db';
import type { ExportRecord, FilterState } from '$lib/types';

export const currentExportId = writable<string | null>(null);

export const exports = writable<ExportRecord[]>([]);

export const filters = writable<FilterState>({
  search: '',
  hasAttachments: null,
  hasArtifacts: null,
  hasCode: null,
  showHidden: false,
  showEmpty: false,
  sortBy: 'date-desc'
});

export const sidebarCollapsed = writable(false);

export const isLoading = writable(false);
export const loadingMessage = writable('');

export async function initializeStores(): Promise<void> {
  isLoading.set(true);
  loadingMessage.set('Loading data...');

  try {
    const allExports = await db.exports.toArray();
    exports.set(allExports);

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

export function addExport(exportRecord: ExportRecord): void {
  exports.update(current => [...current, exportRecord]);
  currentExportId.set(exportRecord.id);
}

export function removeExport(exportId: string): void {
  exports.update(current => current.filter(e => e.id !== exportId));
  currentExportId.update(current => current === exportId ? null : current);
}

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
