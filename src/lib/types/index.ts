// Claude Export Data Types — reverse-engineered from actual Claude.ai data exports.

export interface User {
  uuid: string;
  full_name: string;
  email_address: string;
  verified_phone_number: string | null;
}

export interface ProjectDoc {
  uuid: string;
  filename: string;
  content: string;
  created_at: string;
}

export interface Project {
  uuid: string;
  name: string;
  description: string;
  is_private: boolean;
  is_starter_project: boolean;
  prompt_template: string;
  created_at: string;
  updated_at: string;
  creator: {
    uuid: string;
    full_name: string;
  };
  docs: ProjectDoc[];
}

// Content Block Types
export interface BaseContentBlock {
  start_timestamp: string | null;
  stop_timestamp: string | null;
  flags: unknown | null;
}

export interface TextContent extends BaseContentBlock {
  type: 'text';
  text: string;
  citations: Citation[];
}

export interface ThinkingContent extends BaseContentBlock {
  type: 'thinking';
  thinking: string;
  summaries: Array<{ summary: string }>;
  cut_off: boolean;
  alternative_display_type: string | null;
}

export interface ToolUseContent extends BaseContentBlock {
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
  message: string;
  integration_name: string | null;
  integration_icon_url: string | null;
  context: unknown | null;
  display_content: unknown | null;
  approval_options: unknown | null;
  approval_key: unknown | null;
}

export interface ToolResultContent extends BaseContentBlock {
  type: 'tool_result';
  name: string;
  content: ToolResultItem[];
  is_error: boolean;
  structured_content: unknown | null;
  message: string | null;
  integration_name: string | null;
  integration_icon_url: string | null;
  display_content: unknown | null;
}

export interface ToolResultItem {
  type: string;
  text?: string;
  uuid?: string;
  /** Image file UUID for type: "image" items */
  file_uuid?: string;
  // Web search specific
  title?: string;
  url?: string;
  metadata?: {
    type: string;
    site_domain: string;
    favicon_url: string;
    site_name: string;
  };
  is_citable?: boolean;
  is_missing?: boolean;
  prompt_context_metadata?: {
    age: string;
    url: string;
    search_provider: string;
  };
}

export interface TokenBudgetContent extends BaseContentBlock {
  type: 'token_budget';
}

export type ContentBlock = 
  | TextContent 
  | ThinkingContent 
  | ToolUseContent 
  | ToolResultContent 
  | TokenBudgetContent;

export interface Citation {
  // Structure TBD based on actual data
  [key: string]: unknown;
}

export interface Attachment {
  file_name: string;
  file_size: number;
  file_type: string;
  extracted_content: string;
  /** True if this is an image/file reference with no actual data (from msg.files) */
  isMissingData?: boolean;
  /** File UUID from Claude API (from files_v2), used to match with db.images */
  file_uuid?: string;
}

export interface FileReference {
  file_name: string;
  file_uuid?: string;
}

export interface ChatMessage {
  uuid: string;
  text: string;
  content: ContentBlock[];
  sender: 'human' | 'assistant';
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
  files: FileReference[];
  files_v2?: FileReference[]; // Extended file data from API
}

export interface Conversation {
  uuid: string;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
  account: {
    uuid: string;
  };
  project_uuid?: string;
  chat_messages: ChatMessage[];
}

// Artifact specific (extracted from tool_use)
export interface ArtifactInput {
  id: string;
  type: string;
  title: string;
  command: 'create' | 'update' | 'delete';
  content: string;
  version_uuid: string;
}

// Internal storage types (Dexie/IndexedDB)

export interface ExportRecord {
  id: string;
  name: string;
  fileName: string;
  user: User;
  projects: Project[];
  importedAt: string;
  conversationCount: number;
  messageCount: number;
  /** Claude organization ID for fetching images */
  organizationId?: string;
  /** Number of images found that need fetching */
  pendingImageCount?: number;
}

/** Stored image fetched from Claude API */
export interface StoredImage {
  /** File UUID from Claude API */
  fileUuid: string;
  exportId: string;
  /** Base64 encoded image data */
  data: string;
  /** MIME type (image/png, image/jpeg, etc.) */
  mimeType: string;
  /** Original filename for matching */
  fileName?: string;
  fetchedAt: string;
}

export interface StoredConversation {
  uuid: string;
  exportId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  accountUuid: string;
  projectUuid?: string;
  messageCount: number;
  hasAttachments: boolean;
  hasArtifacts: boolean;
  hasCode: boolean;
  hasThinking: boolean;
  isHidden: boolean;
  hasFilesInExport: boolean; // True if JSON export included files/files_v2
}

export interface StoredMessage {
  uuid: string;
  conversationUuid: string;
  exportId: string;
  index: number; // Position in conversation
  sender: 'human' | 'assistant';
  text: string; // Flattened text for search
  content: ContentBlock[];
  attachments: Attachment[];
  files: FileReference[];
  createdAt: string;
  // Computed flags
  hasThinking: boolean;
  hasToolUse: boolean;
  hasAttachments: boolean;
}

export interface EditRecord {
  id: string;
  messageUuid: string;
  originalText: string;
  currentText: string;
  editHistory: Array<{
    text: string;
    timestamp: string;
  }>;
  isDirty: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilterState {
  search: string;
  hasAttachments: boolean | null;
  hasArtifacts: boolean | null;
  hasCode: boolean | null;
  showHidden: boolean;
  showEmpty: boolean;
  sortBy: 'date-desc' | 'date-asc' | 'messages' | 'name';
}

export type Sender = 'human' | 'assistant';
