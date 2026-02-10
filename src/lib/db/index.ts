import Dexie, { type EntityTable } from 'dexie';
import type { 
  ExportRecord, 
  StoredConversation, 
  StoredMessage, 
  EditRecord,
  StoredImage
} from '$lib/types';

// Database class definition
class ClaudeDataViewerDB extends Dexie {
  exports!: EntityTable<ExportRecord, 'id'>;
  conversations!: EntityTable<StoredConversation, 'uuid'>;
  messages!: EntityTable<StoredMessage, 'uuid'>;
  edits!: EntityTable<EditRecord, 'id'>;
  images!: EntityTable<StoredImage, 'fileUuid'>;

  constructor() {
    super('ClaudeDataViewer');

    this.version(1).stores({
      exports: 'id, name, importedAt',
      conversations: [
        'uuid',
        'exportId',
        'name',
        'createdAt',
        'updatedAt',
        'accountUuid',
        'projectUuid',
        'isHidden',
        'hasFilesInExport',
        '[exportId+createdAt]',
        '[exportId+isHidden]',
        '[projectUuid+createdAt]'
      ].join(', '),
      messages: [
        'uuid',
        'conversationUuid',
        'exportId',
        'index',
        'sender',
        'createdAt',
        '[conversationUuid+index]'
      ].join(', '),
      edits: 'id, messageUuid, isDirty, updatedAt',
      images: 'fileUuid, exportId, fetchedAt'
    });
  }
}

// Singleton instance
export const db = new ClaudeDataViewerDB();

// Helper functions for common operations
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.exports, db.conversations, db.messages, db.edits, db.images], async () => {
    await db.exports.clear();
    await db.conversations.clear();
    await db.messages.clear();
    await db.edits.clear();
    await db.images.clear();
  });
}

export async function deleteExport(exportId: string): Promise<void> {
  await db.transaction('rw', [db.exports, db.conversations, db.messages, db.images], async () => {
    await db.exports.delete(exportId);
    await db.conversations.where('exportId').equals(exportId).delete();
    await db.messages.where('exportId').equals(exportId).delete();
    await db.images.where('exportId').equals(exportId).delete();
  });
}

export async function getExportStats(): Promise<{
  totalExports: number;
  totalConversations: number;
  totalMessages: number;
}> {
  const [totalExports, totalConversations, totalMessages] = await Promise.all([
    db.exports.count(),
    db.conversations.count(),
    db.messages.count()
  ]);
  
  return { totalExports, totalConversations, totalMessages };
}

export async function hideConversation(uuid: string, hidden: boolean = true): Promise<void> {
  await db.conversations.update(uuid, { isHidden: hidden });
}

export async function getConversationMessages(conversationUuid: string): Promise<StoredMessage[]> {
  return db.messages
    .where('conversationUuid')
    .equals(conversationUuid)
    .sortBy('index');
}

export async function getConversationsForExport(
  exportId: string,
  options: {
    includeHidden?: boolean;
    search?: string;
    hasAttachments?: boolean;
    hasArtifacts?: boolean;
    hasCode?: boolean;
  } = {}
): Promise<StoredConversation[]> {
  let collection = db.conversations.where('exportId').equals(exportId);
  
  let results = await collection.toArray();
  
  // Apply filters
  if (!options.includeHidden) {
    results = results.filter(c => !c.isHidden);
  }
  
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    results = results.filter(c => 
      c.name.toLowerCase().includes(searchLower)
    );
  }
  
  if (options.hasAttachments !== undefined) {
    results = results.filter(c => c.hasAttachments === options.hasAttachments);
  }
  
  if (options.hasArtifacts !== undefined) {
    results = results.filter(c => c.hasArtifacts === options.hasArtifacts);
  }
  
  if (options.hasCode !== undefined) {
    results = results.filter(c => c.hasCode === options.hasCode);
  }
  
  return results;
}

// Edit management
export async function saveEdit(
  messageUuid: string, 
  originalText: string, 
  newText: string
): Promise<void> {
  const existingEdit = await db.edits.where('messageUuid').equals(messageUuid).first();
  const now = new Date().toISOString();
  
  if (existingEdit) {
    // Add to history and update current
    await db.edits.update(existingEdit.id, {
      currentText: newText,
      editHistory: [
        ...existingEdit.editHistory,
        { text: existingEdit.currentText, timestamp: now }
      ],
      isDirty: true,
      updatedAt: now
    });
  } else {
    // Create new edit record
    await db.edits.add({
      id: crypto.randomUUID(),
      messageUuid,
      originalText,
      currentText: newText,
      editHistory: [],
      isDirty: true,
      createdAt: now,
      updatedAt: now
    });
  }
}

export async function getEditForMessage(messageUuid: string): Promise<EditRecord | undefined> {
  return db.edits.where('messageUuid').equals(messageUuid).first();
}

export async function revertEdit(messageUuid: string): Promise<void> {
  await db.edits.where('messageUuid').equals(messageUuid).delete();
}

// Image management
export async function getImage(fileUuid: string): Promise<StoredImage | undefined> {
  return db.images.get(fileUuid);
}

export async function saveImage(image: StoredImage): Promise<void> {
  await db.images.put(image);
}

export async function getImagesForExport(exportId: string): Promise<StoredImage[]> {
  return db.images.where('exportId').equals(exportId).toArray();
}

export async function getImageByFilename(exportId: string, filename: string): Promise<StoredImage | undefined> {
  const images = await getImagesForExport(exportId);
  return images.find(img => img.fileName === filename);
}

export async function updateExportOrgId(exportId: string, organizationId: string): Promise<void> {
  await db.exports.update(exportId, { organizationId });
}

export async function getConversationsForProject(projectUuid: string): Promise<StoredConversation[]> {
  return db.conversations.where('projectUuid').equals(projectUuid).sortBy('updatedAt');
}
