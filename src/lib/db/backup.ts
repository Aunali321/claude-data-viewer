/**
 * Whole-database backup & restore.
 *
 * Since all data lives in the browser's IndexedDB (there is no portable .db
 * file on disk), these helpers serialize the entire database to a single JSON
 * file the user can save anywhere, and restore it on any browser/machine.
 *
 * The backup includes every store: exports, conversations, messages, edits,
 * and fetched images (base64) — i.e. a full, round-trippable snapshot.
 */
import { exportDB, importInto, peakImportFile } from 'dexie-export-import';
import { db } from './index';

/** Serialize the whole database to a Blob (JSON). */
export async function exportBackup(): Promise<Blob> {
  return exportDB(db, { prettyJson: false });
}

/** Trigger a browser download of a backup blob with a dated filename. */
export function downloadBackup(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const a = document.createElement('a');
  a.href = url;
  a.download = `claude-viewer-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Convenience: build and download a backup in one call. */
export async function saveBackup(): Promise<void> {
  const blob = await exportBackup();
  downloadBackup(blob);
}

/** Inspect a candidate backup file without importing it. */
export async function inspectBackup(file: File | Blob): Promise<{
  databaseName: string;
  rowCount: number;
  /** True if this backup belongs to the current database. */
  matches: boolean;
}> {
  const meta = await peakImportFile(file);
  const rowCount = meta.data.tables.reduce((sum, t) => sum + t.rowCount, 0);
  return {
    databaseName: meta.data.databaseName,
    rowCount,
    matches: meta.data.databaseName === db.name
  };
}

/**
 * Restore a backup, replacing all current data.
 *
 * Validates the file is a backup of *this* database before touching anything,
 * so a wrong file can't wipe your data. Tables present in the backup are
 * cleared before import (a clean replace, not a merge).
 */
export async function restoreBackup(file: File | Blob): Promise<void> {
  const { databaseName } = await inspectBackup(file);
  if (databaseName !== db.name) {
    throw new Error(
      `This file is a backup of "${databaseName}", not ${db.name}. Restore aborted.`
    );
  }

  await importInto(db, file, {
    clearTablesBeforeImport: true,
    acceptVersionDiff: true
  });
}
