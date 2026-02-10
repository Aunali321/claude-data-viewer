import { db, saveImage } from '$lib/db';
import type { StoredImage } from '$lib/types';

export async function findConversationsWithImages(exportId: string): Promise<Set<string>> {
  const conversations = await db.conversations
    .where('exportId')
    .equals(exportId)
    .and(c => c.hasFilesInExport === true)
    .toArray();
  
  return new Set(conversations.map(c => c.uuid));
}

interface ConversationFile {
  file_uuid: string;
  file_name: string;
  file_kind: string;
  preview_url?: string;
  thumbnail_url?: string;
  preview_asset?: {
    url: string;
  };
  thumbnail_asset?: {
    url: string;
  };
}

interface ConversationMessage {
  uuid: string;
  files?: ConversationFile[];
  files_v2?: ConversationFile[];
}

interface ConversationResponse {
  uuid: string;
  chat_messages?: ConversationMessage[];
}

async function fetchImageFromUrl(
  url: string,
  cookieString: string,
  retries = 3
): Promise<{ data: string; mimeType: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('/api/proxy-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          cookieString
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        const errorMsg = error.error || `HTTP ${response.status}`;
        
        // If 403 or 429, wait and retry
        if ((response.status === 403 || response.status === 429) && attempt < retries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        throw new Error(errorMsg);
      }
      
      const result = await response.json();
      return { data: result.data, mimeType: result.mimeType };
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Wait before retry
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error('Failed after retries');
}

export interface FetchConversationImagesProgress {
  conversationUuid: string;
  totalFiles: number;
  completed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ fileUuid: string; error: string }>;
}

export async function fetchConversationImages(
  conversationUuid: string,
  organizationId: string,
  cookieString: string,
  exportId: string,
  onProgress?: (progress: FetchConversationImagesProgress) => void
): Promise<FetchConversationImagesProgress> {
  const response = await fetch('/api/fetch-conversation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      conversationUuid,
      organizationId,
      cookieString
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  const data: ConversationResponse = await response.json();
  
  const progress: FetchConversationImagesProgress = {
    conversationUuid,
    totalFiles: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    errors: []
  };
  
  const filesToFetch = new Map<string, string>();
  
  for (const msg of data.chat_messages || []) {
    const files = msg.files_v2 || msg.files || [];
    for (const file of files) {
      if (file.file_kind === 'image' && file.file_uuid) {
        const imageUrl = file.thumbnail_asset?.url || file.thumbnail_url;
        if (imageUrl) {
          filesToFetch.set(file.file_uuid, imageUrl);
        }
      }
    }
  }
  
  progress.totalFiles = filesToFetch.size;
  onProgress?.(progress);
  
  for (const [fileUuid, imageUrl] of filesToFetch) {
    try {
      // Add small delay to avoid rate limiting (200ms between requests)
      if (progress.completed > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const { data: base64Data, mimeType } = await fetchImageFromUrl(
        imageUrl,
        cookieString
      );
      
      // Find the file to get its name
      const file = (data.chat_messages || [])
        .flatMap(msg => msg.files_v2 || msg.files || [])
        .find(f => f.file_uuid === fileUuid);
      
      const image: StoredImage = {
        fileUuid,
        exportId,
        data: base64Data,
        mimeType,
        fileName: file?.file_name,
        fetchedAt: new Date().toISOString()
      };
      
      await saveImage(image);
      progress.succeeded++;
    } catch (error) {
      progress.failed++;
      progress.errors.push({
        fileUuid,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    progress.completed++;
    onProgress?.(progress);
  }
  
  return progress;
}

export interface FetchAllImagesProgress {
  totalConversations: number;
  completedConversations: number;
  currentConversationUuid?: string;
  totalFiles: number;
  succeededFiles: number;
  failedFiles: number;
  conversationErrors: Array<{ conversationUuid: string; error: string }>;
  fileErrors: Array<{ fileUuid: string; error: string }>;
}

export async function fetchAllImages(
  exportId: string,
  organizationId: string,
  cookieString: string,
  onProgress?: (progress: FetchAllImagesProgress) => void
): Promise<FetchAllImagesProgress> {
  const conversations = await db.conversations
    .where('exportId')
    .equals(exportId)
    .and(c => c.hasFilesInExport === true)
    .toArray();
  
  const progress: FetchAllImagesProgress = {
    totalConversations: conversations.length,
    completedConversations: 0,
    totalFiles: 0,
    succeededFiles: 0,
    failedFiles: 0,
    conversationErrors: [],
    fileErrors: []
  };
  
  onProgress?.(progress);
  
  for (const conv of conversations) {
    progress.currentConversationUuid = conv.uuid;
    onProgress?.(progress);
    
    try {
      const convProgress = await fetchConversationImages(
        conv.uuid,
        organizationId,
        cookieString,
        exportId,
        (cp) => {
          progress.totalFiles = progress.succeededFiles + progress.failedFiles + cp.totalFiles - cp.completed;
          onProgress?.(progress);
        }
      );
      
      progress.succeededFiles += convProgress.succeeded;
      progress.failedFiles += convProgress.failed;
      progress.fileErrors.push(...convProgress.errors);
    } catch (error) {
      progress.conversationErrors.push({
        conversationUuid: conv.uuid,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    progress.completedConversations++;
    onProgress?.(progress);
  }
  
  progress.currentConversationUuid = undefined;
  onProgress?.(progress);
  
  return progress;
}
