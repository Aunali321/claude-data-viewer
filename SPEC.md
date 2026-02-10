# Claude Data Viewer - Technical Specification

## Overview

A fully offline, privacy-first web application for viewing, reviewing, editing, and exporting Claude.ai conversation exports. Built with SvelteKit and Tailwind CSS, designed for power users who need to review conversations for synthetic data generation.

**Primary Use Cases:**
1. Browse and search Claude.ai exported conversations
2. Review conversation content with full fidelity (thinking blocks, artifacts, attachments)
3. Select and edit specific messages for synthetic data preparation
4. Export selected messages in configurable JSON formats

---

## Data Model

### Source Files (Claude Export Format)

Each export is a zip file containing:

```
claude_data_export_*.zip
├── users.json
├── projects.json
└── conversations.json
```

#### users.json
```typescript
interface User {
  uuid: string;
  full_name: string;
  email_address: string;
  verified_phone_number: string | null;
}
```

#### projects.json
```typescript
interface Project {
  uuid: string;
  name: string;
  description: string;
  is_private: boolean;
  is_starter_project: boolean;
  prompt_template: string;
  created_at: string; // ISO 8601
  updated_at: string;
  creator: {
    uuid: string;
    full_name: string;
  };
  docs: ProjectDoc[];
}

interface ProjectDoc {
  uuid: string;
  filename: string;
  content: string; // Full document content (markdown, etc.)
  created_at: string;
}
```

#### conversations.json
```typescript
interface Conversation {
  uuid: string;
  name: string;
  summary: string; // Often empty
  created_at: string;
  updated_at: string;
  account: {
    uuid: string; // References users.json
  };
  chat_messages: ChatMessage[];
}

interface ChatMessage {
  uuid: string;
  text: string; // Flattened text content (convenience field)
  content: ContentBlock[];
  sender: "human" | "assistant";
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
  files: FileReference[];
}

interface ContentBlock {
  start_timestamp: string | null;
  stop_timestamp: string | null;
  flags: unknown | null; // Purpose TBD, show as badge if present
  type: "text" | "thinking" | "tool_use" | "tool_result" | "token_budget";
  // Type-specific fields below
}

interface TextContent extends ContentBlock {
  type: "text";
  text: string;
  citations: Citation[]; // Usually empty
}

interface ThinkingContent extends ContentBlock {
  type: "thinking";
  thinking: string; // Full thinking text
  summaries: Array<{ summary: string }>; // AI-generated summaries
  cut_off: boolean; // True if thinking was truncated
  alternative_display_type: string | null;
}

interface ToolUseContent extends ContentBlock {
  type: "tool_use";
  name: string; // e.g., "artifacts", "web_search"
  input: Record<string, unknown>; // Tool-specific input
  message: string; // Display message
  integration_name: string | null;
  integration_icon_url: string | null;
  context: unknown | null;
  display_content: unknown | null;
  approval_options: unknown | null;
  approval_key: unknown | null;
}

interface ToolResultContent extends ContentBlock {
  type: "tool_result";
  name: string;
  content: Array<{
    type: string;
    text?: string;
    // For web_search results:
    title?: string;
    url?: string;
    metadata?: {
      type: string;
      site_domain: string;
      favicon_url: string;
      site_name: string;
    };
    is_citable?: boolean;
    prompt_context_metadata?: {
      age: string;
      url: string;
      search_provider: string;
    };
  }>;
  is_error: boolean;
  structured_content: unknown | null;
}

interface TokenBudgetContent extends ContentBlock {
  type: "token_budget";
  // Internal context management - show detailed breakdown
}

interface Attachment {
  file_name: string;
  file_size: number; // bytes
  file_type: string; // e.g., "pdf"
  extracted_content: string; // Full extracted text
}

interface FileReference {
  file_name: string;
}

interface Citation {
  // Structure TBD - render as footnotes if present
}
```

### Artifact Structure (within tool_use)

```typescript
interface ArtifactInput {
  id: string;
  type: string; // e.g., "text/markdown", "application/vnd.ant.code"
  title: string;
  command: "create" | "update" | "delete";
  content: string;
  version_uuid: string;
}
```

### Internal Storage (Dexie.js/IndexedDB)

```typescript
// Database schema
interface DataStore {
  exports: ExportRecord[];
  conversations: StoredConversation[];
  messages: StoredMessage[];
  edits: EditRecord[];
  hiddenConversations: string[]; // UUIDs
}

interface ExportRecord {
  id: string; // Generated
  name: string; // From filename or user input
  user: User;
  projects: Project[];
  importedAt: string;
}

interface StoredConversation {
  uuid: string;
  exportId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  accountUuid: string;
  messageCount: number;
  hasAttachments: boolean;
  hasArtifacts: boolean;
  hasCode: boolean;
  isHidden: boolean;
}

interface StoredMessage {
  uuid: string;
  conversationUuid: string;
  exportId: string;
  sender: "human" | "assistant";
  content: ContentBlock[]; // Full content preserved
  attachments: Attachment[];
  files: FileReference[];
  createdAt: string;
  // Computed for filtering
  hasThinking: boolean;
  hasToolUse: boolean;
}

interface EditRecord {
  id: string;
  messageUuid: string;
  originalText: string;
  currentText: string;
  editHistory: Array<{
    text: string;
    timestamp: string;
  }>;
  isDirty: boolean; // Has unsaved changes
}
```

---

## Architecture

### Tech Stack

- **Framework**: SvelteKit (existing project)
- **Styling**: Tailwind CSS (existing)
- **Storage**: Dexie.js (IndexedDB wrapper)
- **Markdown**: marked + highlight.js for GFM + syntax highlighting
- **Diff**: diff library for edit history comparison
- **Zip**: JSZip for handling zip files directly
- **Virtual Scroll**: svelte-virtual-list or similar

### Application Structure

```
src/
├── lib/
│   ├── db/
│   │   ├── schema.ts        # Dexie schema definitions
│   │   ├── import.ts        # Import/parse logic
│   │   └── queries.ts       # Common query patterns
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.svelte
│   │   │   ├── Header.svelte
│   │   │   └── ThemeToggle.svelte
│   │   ├── conversation/
│   │   │   ├── ConversationList.svelte
│   │   │   ├── ConversationView.svelte
│   │   │   ├── MessageItem.svelte
│   │   │   └── VirtualMessageList.svelte
│   │   ├── content/
│   │   │   ├── TextBlock.svelte
│   │   │   ├── ThinkingBlock.svelte
│   │   │   ├── ToolUseBlock.svelte
│   │   │   ├── ToolResultBlock.svelte
│   │   │   ├── TokenBudgetBlock.svelte
│   │   │   ├── ArtifactView.svelte
│   │   │   ├── WebSearchResults.svelte
│   │   │   └── AttachmentCard.svelte
│   │   ├── editor/
│   │   │   ├── MessageEditor.svelte
│   │   │   ├── DiffView.svelte
│   │   │   └── EditHistory.svelte
│   │   ├── export/
│   │   │   ├── ExportDialog.svelte
│   │   │   ├── FormatConfig.svelte
│   │   │   └── SelectionManager.svelte
│   │   └── shared/
│   │       ├── FileDropZone.svelte
│   │       ├── SearchInput.svelte
│   │       ├── FilterPanel.svelte
│   │       └── Badge.svelte
│   ├── stores/
│   │   ├── app.ts           # Global app state
│   │   ├── selection.ts     # Message selection state
│   │   └── theme.ts         # Theme preferences
│   └── utils/
│       ├── markdown.ts      # Markdown rendering
│       ├── duration.ts      # Timestamp calculations
│       └── export.ts        # Export format generators
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte         # Import/landing
│   ├── conversations/
│   │   └── [id]/
│   │       └── +page.svelte # Conversation view
│   ├── projects/
│   │   └── +page.svelte     # Projects browser
│   ├── stats/
│   │   └── +page.svelte     # Statistics dashboard
│   └── export/
│       └── +page.svelte     # Export configuration
```

---

## User Interface

### Theme System

- **Default**: Dark mode
- **Option**: Light mode toggle
- System preference detection on first load
- Persist preference in localStorage

### Layout

**Desktop (≥1024px)**:
- Collapsible sidebar (280px default, can hide completely)
- Main content area fills remaining space
- Sidebar contains: export list, conversation list, filters

**Tablet (768px-1023px)**:
- Sidebar as overlay/drawer
- Hamburger menu to toggle

**Mobile (<768px)**:
- Full-screen views with back navigation
- Bottom navigation for main sections

### Pages

#### 1. Import/Landing Page (`/`)

**First-time experience:**
- Large drop zone: "Drop Claude export zip files here"
- Alternative: File picker button, paste support
- Accepts: `.zip` files directly (no pre-extraction needed)
- Shows import progress with file parsing status

**With existing data:**
- Redirect to conversations list
- Small "Import more" button in header

#### 2. Conversations List (`/conversations`)

**Sidebar (when visible):**
- Export selector dropdown (if multiple exports loaded)
- Account badge: `{full_name} @{email_domain}`
- Search input: searches conversation names + message text
- Filter toggles:
  - Has attachments
  - Has artifacts  
  - Has code blocks
  - Show empty conversations (off by default)
  - Show hidden conversations (off by default)
- Sort dropdown: Date (newest/oldest), Message count, Name A-Z

**Conversation list items:**
- Conversation name (truncated)
- Message count badge
- Relative date ("2 hours ago")
- Content type indicators (attachment icon, artifact icon, code icon)
- Hidden indicator if applicable

**Keyboard navigation:**
- Arrow up/down: navigate list
- Enter: open selected conversation
- Ctrl+F: focus search

#### 3. Conversation View (`/conversations/[id]`)

**Header:**
- Back button (to list)
- Conversation name
- Message count
- Date range
- Account badge
- Actions: Hide conversation, Export selected

**Message list (virtual scrolled):**
Each message shows:
- Sender indicator (Human/Assistant)
- Selection checkbox (for export)
- Duration indicator (e.g., "3.2s" from start_timestamp to stop_timestamp)
- Flags badge (if flags field is non-null)
- Content blocks rendered by type

**Content Block Rendering:**

*Text blocks:*
- Full GFM markdown rendering
- Syntax highlighting for code blocks (all common languages)
- Citations as footnote-style `[1]` with hover preview

*Thinking blocks:*
- Collapsible section, collapsed by default
- Header shows first summary from summaries array
- Expand to see full thinking text
- Warning indicator if `cut_off: true` ("Thinking was truncated")

*Tool use + Tool result:*
- Show both blocks together
- Tool name as header
- Expandable input parameters (JSON viewer)
- Expandable result content
- Special rendering for known tools:

*Artifacts (tool_use.name === "artifacts"):*
- Dual-view toggle: Rendered / Raw
- Rendered: markdown/code with syntax highlighting
- Raw: JSON view of the tool call
- Version dropdown if multiple version_uuids exist in conversation
- Shows artifact title, type

*Web Search (tool_use.name === "web_search"):*
- Query displayed prominently
- Results as styled citation cards:
  - Favicon + site name
  - Title as link
  - Snippet text (truncated)
  - "Cited" badge if referenced in response

*Token budget blocks:*
- Detailed breakdown panel
- Shows: type, any available metrics
- Collapsed by default, expandable

**Attachments:**
- File card with:
  - File icon based on type
  - Filename
  - Size (formatted: "25.2 KB")
  - Preview: first 5 lines of extracted_content
- Click to expand full extracted_content in modal/panel

**Message selection:**
- Checkbox on each message
- Shift+click for range selection
- Bulk actions bar appears when selection active:
  - Select all / Deselect all
  - Invert selection
  - Export selected
  - Count indicator

**Message editing:**
- Click edit icon on message
- Opens inline editor for text content
- Text-only editing (metadata read-only)
- Save / Cancel buttons
- Explicit save required (no auto-save)
- "View original" button to see diff
- Edit history accessible showing all previous versions

#### 4. Projects Browser (`/projects`)

- List of all projects from all loaded exports
- Shows: project name, description, doc count, creator
- Click to view project details:
  - Full description
  - prompt_template if set
  - List of docs with full content (markdown rendered)
- Link to filter conversations by project (future enhancement)

#### 5. Statistics Page (`/stats`)

Dashboard showing:
- Total conversations across all exports
- Total messages
- Date range of conversations
- Messages over time (simple chart)
- Export breakdown (conversations per export)
- Content type distribution (% with attachments, artifacts, code)

#### 6. Export Page (`/export`)

Accessed via "Export selected" action or direct navigation.

**Selection summary:**
- Count of selected messages
- From N conversations

**Export format configuration:**
- Format selector:
  - OpenAI chat format: `[{role, content}]`
  - Anthropic messages format: `[{role, content: [{type, text}]}]`  
  - Full metadata: includes UUIDs, timestamps
  - Custom: field picker UI

**Multi-turn handling:**
- Radio selection:
  1. Single conversation (all selected as one)
  2. Multiple snippets per file (selected ranges as array)
  3. System + turns format (first message as system, rest as turns)
  4. Split into separate examples (each message pair as own entry)

**Field inclusion (for custom format):**
- Checkboxes for: uuid, timestamps, sender, text, thinking, tool_calls
- Preview of output format

**Export action:**
- Download as `.json` file
- Filename: `claude-export-{timestamp}.json`

---

## Interactions & Behaviors

### Import Flow

1. User drops/selects zip file(s)
2. JSZip extracts in memory
3. Parse users.json, projects.json, conversations.json
4. Generate export record with unique ID
5. Index conversations and messages into Dexie
6. Compute derived fields (hasAttachments, hasCode, etc.)
7. Show completion with stats

**Duplicate handling:** Each export kept separate. Same conversation UUID in different exports treated as distinct (namespaced by exportId).

### Search

- Scope: Conversation names + message text content
- Excludes: attachment content, artifact content, thinking blocks
- Implementation: Dexie full-text search or simple includes() on indexed text field
- Results: Highlight matching conversations in list

### Edit Workflow

1. Click edit on a message
2. Editor opens with current text (or original if never edited)
3. User modifies text
4. Click Save → creates EditRecord, marks as dirty
5. Click Cancel → discards unsaved changes
6. View diff: shows original vs current with inline diff highlighting
7. View history: shows all saved versions with timestamps

### Export Workflow

1. Select messages via checkboxes across one or more conversations
2. Click "Export selected" 
3. Configure format in export dialog
4. Preview shows sample output
5. Click Download
6. JSON file saved to downloads

---

## Performance Considerations

### Lazy Loading

- Conversation list: load all conversation metadata upfront (small)
- Message content: load on-demand when conversation opened
- Attachments: load extracted_content only when expanded

### Virtual Scrolling

- Message list uses virtual scrolling
- Only render visible messages + buffer
- Handles 62+ message conversations smoothly

### Indexing

Dexie indexes on:
- conversations: exportId, uuid, createdAt, name
- messages: conversationUuid, uuid, createdAt

### Memory Management

- Parsed JSON released after indexing to Dexie
- Content loaded from IndexedDB on demand
- Consider Web Workers for initial import parsing

---

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `↑` / `↓` | Conversation list | Navigate conversations |
| `Enter` | Conversation list | Open selected conversation |
| `Escape` | Conversation view | Back to list |
| `↑` / `↓` | Conversation view | Navigate messages |
| `Space` | Conversation view | Toggle message selection |
| `Ctrl+A` | Conversation view | Select all messages |
| `Ctrl+Shift+A` | Conversation view | Deselect all |
| `Ctrl+F` | Global | Focus search |
| `Ctrl+E` | Selected message | Edit message |
| `Ctrl+S` | Editing | Save edit |
| `Escape` | Editing | Cancel edit |

---

## Error Handling

### Import Errors

- Invalid zip: "Could not read zip file. Please ensure it's a valid Claude export."
- Missing files: "Export missing required files: {list}. Expected users.json, projects.json, conversations.json."
- Parse error: "Could not parse {file}: {error}. The file may be corrupted."

### Storage Errors

- Quota exceeded: "Browser storage full. Please delete some exports or clear browser data."
- IndexedDB unavailable: "Local storage not available. Please enable cookies/storage for this site."

### General

- All errors shown as dismissible toast notifications
- Critical errors show modal with details
- Console logging for debugging

---

## Data Privacy

- **Fully offline**: No network requests except for initial page load
- **No analytics**: No tracking, telemetry, or external scripts
- **No CDN**: All libraries bundled (consider bundle size)
- **Local storage only**: All data in IndexedDB, never leaves browser
- **No cloud sync**: Data export is manual download only

---

## Future Considerations (Out of Scope for v1)

- Cloud sync to user's own storage (S3, GDrive)
- Tagging/labeling system for conversations
- Conversation merging
- Advanced search with filters (date range, sender, etc.)
- PDF export
- Markdown export
- Code block extraction
- Project-conversation linking in UI
- Collaborative review (sharing)

---

## Appendix: Sample Data Structures

### Minimal Conversation Example

```json
{
  "uuid": "6c74164a-649f-4c12-a86e-cfaf3bf76a4a",
  "name": "Estimating download time",
  "summary": "",
  "created_at": "2025-12-04T04:54:47.849234Z",
  "updated_at": "2025-12-04T04:54:55.582123Z",
  "account": {"uuid": "d2b860db-06be-4b3d-9ea8-0e8fe1ebc9fb"},
  "chat_messages": [
    {
      "uuid": "019ae7b6-865d-7593-8a02-5ef36121c098",
      "text": "231 songs downloaded in 1 hour 43 minutes...",
      "content": [
        {
          "type": "text",
          "text": "231 songs downloaded in 1 hour 43 minutes...",
          "start_timestamp": "2025-12-04T04:54:50.227443Z",
          "stop_timestamp": "2025-12-04T04:54:50.227443Z",
          "citations": []
        }
      ],
      "sender": "human",
      "created_at": "2025-12-04T04:54:50.247382Z",
      "attachments": [],
      "files": []
    }
  ]
}
```

### Thinking Block Example

```json
{
  "type": "thinking",
  "thinking": "The user is asking about UPI vs Venmo...",
  "summaries": [
    {"summary": "Comparing payment systems: UPI and Venmo's key differences"}
  ],
  "cut_off": false,
  "start_timestamp": "2025-07-26T02:46:14.491629Z",
  "stop_timestamp": "2025-07-26T02:46:20.424366Z"
}
```

### Artifact Example

```json
{
  "type": "tool_use",
  "name": "artifacts",
  "input": {
    "id": "agent_migration_plan",
    "type": "text/markdown",
    "title": "Agent Migration & Implementation Plan",
    "command": "create",
    "content": "# Agent Migration & Implementation Plan\n\n## Overview...",
    "version_uuid": "53aacc1d-a9e1-4bd4-9cd5-aa03ae55b5b2"
  }
}
```

### Attachment Example

```json
{
  "file_name": "RW - Open Source Funding.pdf",
  "file_size": 25171,
  "file_type": "pdf",
  "extracted_content": "A\nDOCUMENTAION REPORT\nON\n\"Research Work\"..."
}
```

### Web Search Example

```json
{
  "type": "tool_use",
  "name": "web_search",
  "input": {"query": "farmland prices India 2024 per acre"},
  "message": "Searching the web"
}
// Followed by:
{
  "type": "tool_result",
  "name": "web_search",
  "content": [
    {
      "type": "knowledge",
      "title": "1 Acre Land Price in India",
      "url": "https://www.sanjeevanifarms.com/...",
      "text": "The 1 acre land price in village areas...",
      "metadata": {
        "site_domain": "sanjeevanifarms.com",
        "favicon_url": "...",
        "site_name": "Sanjeevani Farms"
      },
      "is_citable": true
    }
  ]
}
```
