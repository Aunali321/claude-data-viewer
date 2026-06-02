import JSZip from 'jszip';
import { db } from './index';
import type { 
  User, 
  Project, 
  Conversation, 
  ContentBlock,
  ExportRecord,
  StoredConversation,
  StoredMessage,
  Attachment,
  FileReference
} from '$lib/types';

export interface ImportProgress {
  stage: 'reading' | 'parsing' | 'indexing' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  details?: {
    conversationsProcessed?: number;
    totalConversations?: number;
    messagesProcessed?: number;
  };
}

export interface ImportResult {
  success: boolean;
  exportId: string;
  exportName: string;
  conversationCount: number;
  messageCount: number;
  error?: string;
}

type ProgressCallback = (progress: ImportProgress) => void;

function getFileTypeFromName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'json': 'application/json',
    'csv': 'text/csv',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext] || ext || 'unknown';
}

function isImageFile(fileName: string): boolean {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return imageExts.includes(ext) || fileName.toLowerCase().includes('image');
}

function mergeFilesIntoAttachments(
  attachments: Attachment[],
  files: FileReference[]
): Attachment[] {
  const existingNames = new Set(attachments.map(a => a.file_name));
  const merged = [...attachments];
  
  for (const file of files) {
    if (!file.file_name || existingNames.has(file.file_name)) continue;
    
    merged.push({
      file_name: file.file_name,
      file_size: 0,
      file_type: getFileTypeFromName(file.file_name),
      extracted_content: '',
      isMissingData: true,
      file_uuid: file.file_uuid
    });
  }
  
  return merged;
}

/**
 * Import a Claude export zip file into the database
 */
export async function importZipFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<ImportResult> {
  const exportId = crypto.randomUUID();
  const exportName = file.name.replace(/\.zip$/i, '').replace(/^claude_data_export_/, '');
  
  try {
    onProgress?.({
      stage: 'reading',
      message: 'Reading zip file...',
      progress: 5
    });
    
    const zip = await JSZip.loadAsync(file);
    
    onProgress?.({
      stage: 'parsing',
      message: 'Parsing export data...',
      progress: 15
    });
    
    const usersFile = zip.file('users.json');
    const projectsFile = zip.file('projects.json');
    const conversationsFile = zip.file('conversations.json');
    
    if (!usersFile || !projectsFile || !conversationsFile) {
      const missing: string[] = [];
      if (!usersFile) missing.push('users.json');
      if (!projectsFile) missing.push('projects.json');
      if (!conversationsFile) missing.push('conversations.json');
      
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }
    
    const [usersJson, projectsJson, conversationsJson] = await Promise.all([
      usersFile.async('string'),
      projectsFile.async('string'),
      conversationsFile.async('string')
    ]);
    
    onProgress?.({
      stage: 'parsing',
      message: 'Parsing JSON data...',
      progress: 25
    });
    
    const users: User[] = JSON.parse(usersJson);
    const projects: Project[] = JSON.parse(projectsJson);
    const conversations: Conversation[] = JSON.parse(conversationsJson);
    
    const user = users[0];
    if (!user) {
      throw new Error('No user found in export');
    }
    
    onProgress?.({
      stage: 'indexing',
      message: 'Indexing conversations...',
      progress: 35,
      details: {
        conversationsProcessed: 0,
        totalConversations: conversations.length
      }
    });
    
    let totalMessages = 0;
    const storedConversations: StoredConversation[] = [];
    const storedMessages: StoredMessage[] = [];
    
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      
      const analysis = analyzeConversation(conv);
      
      const hasFilesInExport = conv.chat_messages.some(msg =>
        (msg.files && msg.files.length > 0) || 
        (msg.files_v2 && msg.files_v2.length > 0)
      );
      
      storedConversations.push({
        uuid: conv.uuid,
        exportId,
        name: conv.name || 'Untitled Conversation',
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        accountUuid: conv.account.uuid,
        projectUuid: conv.project_uuid,
        messageCount: conv.chat_messages.length,
        hasAttachments: analysis.hasAttachments,
        hasArtifacts: analysis.hasArtifacts,
        hasCode: analysis.hasCode,
        hasThinking: analysis.hasThinking,
        isHidden: false,
        hasFilesInExport
      });
      
      for (let j = 0; j < conv.chat_messages.length; j++) {
        const msg = conv.chat_messages[j];
        const mergedAttachments = mergeFilesIntoAttachments(msg.attachments, msg.files);
        const msgAnalysis = analyzeMessage(msg.content, mergedAttachments);
        
        storedMessages.push({
          uuid: msg.uuid,
          conversationUuid: conv.uuid,
          exportId,
          index: j,
          sender: msg.sender,
          text: msg.text || extractTextFromContent(msg.content),
          content: msg.content,
          attachments: mergedAttachments,
          files: msg.files,
          createdAt: msg.created_at,
          hasThinking: msgAnalysis.hasThinking,
          hasToolUse: msgAnalysis.hasToolUse,
          hasAttachments: mergedAttachments.length > 0
        });
        totalMessages++;
      }
      
      if (i % 10 === 0 || i === conversations.length - 1) {
        const progressPercent = 35 + Math.round((i / conversations.length) * 55);
        onProgress?.({
          stage: 'indexing',
          message: `Indexing conversations (${i + 1}/${conversations.length})...`,
          progress: progressPercent,
          details: {
            conversationsProcessed: i + 1,
            totalConversations: conversations.length,
            messagesProcessed: totalMessages
          }
        });
      }
    }
    
    const exportRecord: ExportRecord = {
      id: exportId,
      name: exportName,
      fileName: file.name,
      user,
      projects,
      importedAt: new Date().toISOString(),
      conversationCount: conversations.length,
      messageCount: totalMessages
    };
    
    onProgress?.({
      stage: 'indexing',
      message: 'Saving to database...',
      progress: 92
    });
    
    await db.transaction('rw', [db.exports, db.conversations, db.messages], async () => {
      await db.exports.add(exportRecord);
      await db.conversations.bulkAdd(storedConversations);
      await db.messages.bulkAdd(storedMessages);
    });
    
    onProgress?.({
      stage: 'complete',
      message: 'Import complete!',
      progress: 100,
      details: {
        conversationsProcessed: conversations.length,
        totalConversations: conversations.length,
        messagesProcessed: totalMessages
      }
    });
    
    return {
      success: true,
      exportId,
      exportName,
      conversationCount: conversations.length,
      messageCount: totalMessages
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    onProgress?.({
      stage: 'error',
      message: errorMessage,
      progress: 0
    });
    
    try {
      await db.exports.delete(exportId);
      await db.conversations.where('exportId').equals(exportId).delete();
      await db.messages.where('exportId').equals(exportId).delete();
    } catch {
      // Ignore cleanup errors
    }
    
    return {
      success: false,
      exportId,
      exportName,
      conversationCount: 0,
      messageCount: 0,
      error: errorMessage
    };
  }
}

/**
 * Analyze a conversation to extract metadata flags
 */
function analyzeConversation(conversation: Conversation): {
  hasAttachments: boolean;
  hasArtifacts: boolean;
  hasCode: boolean;
  hasThinking: boolean;
} {
  let hasAttachments = false;
  let hasArtifacts = false;
  let hasCode = false;
  let hasThinking = false;
  
  for (const msg of conversation.chat_messages) {
    if (msg.attachments.length > 0 || msg.files.length > 0) {
      hasAttachments = true;
    }
    
    for (const block of msg.content) {
      if (block.type === 'thinking') {
        hasThinking = true;
      }
      
      if (block.type === 'tool_use' && block.name === 'artifacts') {
        hasArtifacts = true;
      }
      
      if (block.type === 'text') {
        if (block.text.includes('```')) {
          hasCode = true;
        }
      }
    }
    
    if (hasAttachments && hasArtifacts && hasCode && hasThinking) {
      break;
    }
  }
  
  return { hasAttachments, hasArtifacts, hasCode, hasThinking };
}

/**
 * Analyze a single message's content blocks
 */
function analyzeMessage(
  content: ContentBlock[], 
  attachments: { file_name: string }[]
): {
  hasThinking: boolean;
  hasToolUse: boolean;
  hasAttachments: boolean;
} {
  let hasThinking = false;
  let hasToolUse = false;
  
  for (const block of content) {
    if (block.type === 'thinking') hasThinking = true;
    if (block.type === 'tool_use') hasToolUse = true;
  }
  
  return {
    hasThinking,
    hasToolUse,
    hasAttachments: attachments.length > 0
  };
}

/**
 * Extract plain text from content blocks for search indexing
 */
function extractTextFromContent(content: ContentBlock[]): string {
  const texts: string[] = [];
  
  for (const block of content) {
    if (block.type === 'text') {
      texts.push(block.text);
    }
  }
  
  return texts.join('\n');
}
