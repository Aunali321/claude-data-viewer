import Dexie, { type EntityTable } from 'dexie';
import type {
  ExportRecord,
  StoredConversation,
  StoredMessage,
  EditRecord,
  StoredImage
} from '$lib/types';

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

export const db = new ClaudeDataViewerDB();

export async function deleteExport(exportId: string): Promise<void> {
  await db.transaction('rw', [db.exports, db.conversations, db.messages, db.images], async () => {
    await db.exports.delete(exportId);
    await db.conversations.where('exportId').equals(exportId).delete();
    await db.messages.where('exportId').equals(exportId).delete();
    await db.images.where('exportId').equals(exportId).delete();
  });
}

export async function hideConversation(uuid: string, hidden: boolean = true): Promise<void> {
  await db.conversations.update(uuid, { isHidden: hidden });
}

export async function saveEdit(
  messageUuid: string,
  originalText: string,
  newText: string
): Promise<void> {
  const existingEdit = await db.edits.where('messageUuid').equals(messageUuid).first();
  const now = new Date().toISOString();

  if (existingEdit) {
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
