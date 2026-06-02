# Claude Data Viewer - Work Log

## Coding Guidelines
- Only write essential or proper docs. No useless single-line comments.
- Commit wherever needed with meaningful messages.

## Project Overview
A fully offline SvelteKit + Tailwind app for viewing, reviewing, editing, and exporting Claude.ai conversation exports.

**Tech Stack:** SvelteKit 2, Svelte 5, Tailwind CSS 4, Dexie.js, JSZip

**Key Files:**
- `SPEC.md` - Complete technical specification
- `src/` - Application source code

---

## Current Status

**Phase:** Feature Implementation
**Last Updated:** 2026-01-24 (Session 5)

### Completed
- [x] Analyzed Claude export data structure (3 zip files)
- [x] Interviewed user for all requirements
- [x] Wrote complete specification (SPEC.md)
- [x] Installed dependencies with bun (dexie, jszip, marked, highlight.js)
- [x] Created comprehensive design system (CSS custom properties in layout.css)
- [x] Set up Dexie database schema (`src/lib/db/index.ts`)
- [x] Created TypeScript types for all data structures (`src/lib/types/index.ts`)
- [x] Implemented zip import logic (`src/lib/db/import.ts`)
- [x] Created theme store with dark/light toggle (`src/lib/stores/theme.ts`)
- [x] Created app state store (`src/lib/stores/app.ts`)
- [x] Built Header component with theme toggle
- [x] Built FileDropZone component with drag-drop + paste
- [x] Built landing page with import flow
- [x] Built Sidebar component with filters
- [x] Built conversations list page
- [x] Built conversation detail view with message rendering
- [x] Built all content block renderers:
  - TextBlock.svelte - Markdown with syntax highlighting + CITATIONS with hover
  - ThinkingBlock.svelte - Collapsible accordion with step count, summary
  - ToolUseBlock.svelte - Claude-style artifact cards with preview thumb
  - ToolResultBlock.svelte - Web search citation cards
  - TokenBudgetBlock.svelte - Context management info
  - AttachmentCard.svelte - File preview with full expand MODAL
- [x] Built MessageItem.svelte with selection checkbox
- [x] Implemented message selection with shift-click range
- [x] Fixed type errors
- [x] Built message editing system:
  - MessageEditor.svelte - Inline text editor with save/cancel
  - DiffView.svelte - Line-by-line diff with LCS algorithm
  - EditHistory.svelte - Version history with restore
  - Edit button on messages, "edited" indicator badge
  - Keyboard shortcuts: Ctrl+S to save, Esc to cancel
- [x] **MAJOR REDESIGN** - Claude-style conversation UI:
  - Human messages: Right-aligned rounded bubbles
  - Assistant messages: Left-aligned, clean flowing text
  - Thinking blocks: Clean accordion with "X steps" header
  - Artifacts: Beautiful cards with dark header, type badge, version, code preview
  - Hover-to-show action buttons (edit, select)
  - Flags badge on messages with flags field
  - Account badge in header showing user name + email domain
  - Hide conversation button
  - Attachment modal for full extracted content
- [x] Citations as footnotes with hover preview (TextBlock.svelte updated)
- [x] **Artifact version dropdown** - COMPLETED!
  - Conversation page collects all artifacts by ID into Map<string, ArtifactInput[]>
  - MessageItem passes versions to ToolUseBlock via getArtifactVersions()
  - ToolUseBlock shows "Version X of Y" dropdown when multiple versions exist
  - Clicking dropdown shows all versions with titles
  - Selecting a version updates the displayed artifact content
- [x] **Export functionality** - COMPLETED!
  - Global selection store (`src/lib/stores/selection.ts`) for multi-conversation selection
  - Export utils (`src/lib/utils/export.ts`) with format converters
  - ExportModal component with live JSON preview
  - Format options: OpenAI Chat, Anthropic Messages, Full Metadata, Custom
  - Multi-turn modes: Single, Multiple snippets, System+turns, Split pairs
  - Field inclusion checkboxes for Custom format
  - Exports edited text when available
  - Syntax-highlighted preview with highlight.js
  - Downloads as `claude-export-{timestamp}.json`
- [x] **Comprehensive Anthropic Export Format** - COMPLETED!
  - Full Messages API compliance per latest Anthropic docs
  - Text blocks with optional citations array preserved
  - Thinking blocks with `{type: "thinking", thinking, signature?}`
  - Tool use blocks with generated IDs: `{type: "tool_use", id, name, input}`
  - Tool result blocks linked by ID: `{type: "tool_result", tool_use_id, content, is_error?}`
  - Attachments: base64 images as `{type: "image"}`, fallback to text for documents
  - Token budget blocks skipped (internal metadata)
  - User messages: tool_result blocks ordered first per API requirements
  - ToolIdTracker class for sequential ID generation and name-based matching
- [x] **Image Fetching** - COMPLETED!
  - Server-side proxy routes to avoid CORS (`/api/fetch-conversation`, `/api/proxy-image`)
  - User provides Organization ID + cookie string from browser DevTools
  - Fetches conversation data and images from Claude API, stores as base64 in IndexedDB
  - Images display inline in message bubbles, clickable for full size modal
  - Retry logic with exponential backoff + 200ms delays to handle rate limiting

### In Progress
(none)

### Next Up
- [ ] Update OpenAI export format to latest spec
- [ ] Projects browser page (`/projects`) - see SPEC.md lines 472-480
- [ ] Stats dashboard page (`/stats`) - see SPEC.md lines 482-490

---

## Session 5 Notes (2026-01-24)

### Image Fetching Implementation

**Implemented complete image fetching system:**
- Server proxy routes avoid CORS issues
- User provides Organization ID + cookie string (copy from DevTools Network tab → Request Headers)
- Fetches full conversation data + images from Claude API
- Stores images as base64 in IndexedDB with fileName for matching
- Images display inline in message bubbles (compact mode), clickable for full view
- Handles rate limiting: retry logic with exponential backoff, 200ms delays between requests
- Shows progress and error reporting in modal

**Key files:**
- `src/routes/api/fetch-conversation/+server.ts` - Conversation data proxy
- `src/routes/api/proxy-image/+server.ts` - Image download proxy
- `src/lib/utils/images.ts` - Fetch logic with retry/delays
- `src/lib/components/images/ImageFetchModal.svelte` - UI for fetching
- `src/lib/components/content/AttachmentCard.svelte` - Inline image display
- `src/lib/db/index.ts` - Added `getImageByFilename()` helper

**Database:**
- `images` table: `fileUuid` (PK), `exportId`, `data` (base64), `mimeType`, `fileName`, `fetchedAt`
- `conversations.hasFilesInExport` flag set during import to identify conversations with images

---

## Session 4 Notes (2026-01-09)

### Image Data Investigation & Handling

**Finding:** Claude export doesn't include image binary data, only references (`msg.files[]`, `msg.attachments[]`, tool_result UUIDs).

**Solution:** Added `isMissingData` flag to attachments, AttachmentCard shows warning badge for missing images. Implemented image fetching feature (see Session 5).

---

## File Structure

```
src/
├── lib/
│   ├── db/
│   │   ├── index.ts      # Dexie schema (exports, conversations, messages, edits, images)
│   │   └── import.ts     # Zip import logic
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.svelte
│   │   │   └── Sidebar.svelte
│   │   ├── conversation/
│   │   │   └── MessageItem.svelte  # Claude-style chat bubbles
│   │   ├── content/
│   │   │   ├── TextBlock.svelte        # Markdown + citations
│   │   │   ├── ThinkingBlock.svelte    # Accordion with steps
│   │   │   ├── ToolUseBlock.svelte     # Artifacts + web search + version dropdown
│   │   │   ├── ToolResultBlock.svelte  # Citation cards + image display
│   │   │   ├── TokenBudgetBlock.svelte
│   │   │   └── AttachmentCard.svelte   # With modal
│   │   ├── editor/
│   │   │   ├── MessageEditor.svelte
│   │   │   ├── DiffView.svelte
│   │   │   └── EditHistory.svelte
│   │   ├── export/
│   │   │   └── ExportModal.svelte      # Export config modal with preview
│   │   ├── images/
│   │   │   └── ImageFetchModal.svelte  # Credential input for image fetching
│   │   └── shared/
│   │       └── FileDropZone.svelte
│   ├── stores/
│   │   ├── theme.ts
│   │   ├── app.ts
│   │   └── selection.ts  # Global message selection state
│   ├── utils/
│   │   ├── export.ts     # Export formatting functions
│   │   └── images.ts     # Image fetching utilities
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte          # Landing/import + image fetch button
│   ├── layout.css            # Design system (100+ CSS vars, --cdv-* prefix)
│   └── conversations/
│       ├── +page.svelte      # Conversation list
│       └── [id]/
│           └── +page.svelte  # Conversation detail + export modal
```

---

## Design System

**Location:** `src/routes/layout.css`

CSS custom properties with `--cdv-` prefix:
- Colors: `--cdv-color-bg-*`, `--cdv-color-text-*`, `--cdv-color-accent-*`
- Role colors: `--cdv-color-human`, `--cdv-color-assistant`, `--cdv-color-thinking`, `--cdv-color-tool`
- Typography: `--cdv-font-*`
- Spacing: `--cdv-space-*`
- Radius: `--cdv-radius-*`

**Fonts:** DM Sans (body), JetBrains Mono (code)
**Accent:** Amber/Gold (#f59e0b)
**Themes:** Dark (default), Light (`.light` class on html)

---

## Database Schema (Dexie)

```typescript
exports: 'id, name, importedAt'
conversations: 'uuid, exportId, name, createdAt, updatedAt, accountUuid, isHidden, [exportId+createdAt], [exportId+isHidden]'
messages: 'uuid, conversationUuid, exportId, index, sender, createdAt, [conversationUuid+index]'
edits: 'id, messageUuid, isDirty, updatedAt'
```

---

## Key Types (from src/lib/types/index.ts)

- `ContentBlock` = TextContent | ThinkingContent | ToolUseContent | ToolResultContent | TokenBudgetContent
- `ArtifactInput` - id, type, title, command, content, version_uuid
- `StoredMessage` - uuid, conversationUuid, sender, content[], attachments[], hasThinking, hasToolUse
- `EditRecord` - messageUuid, originalText, currentText, editHistory[], isDirty
- `ExportOptions` - format, multiTurnMode, includeFields

---

## Commands

```bash
bun run dev      # Start dev server
bun run check    # Type check (0 errors, 0 warnings)
bun run build    # Production build
```

---

## Remaining Work (Priority Order)

1. **Update OpenAI format** - Match latest OpenAI Chat Completions API spec
2. **Projects browser** - Create /projects page 
3. **Stats dashboard** - Create /stats page
4. **Virtual scrolling** - For long conversations (svelte-virtual-list)
