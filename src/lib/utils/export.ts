/**
 * Export formatting utilities for Claude conversation data.
 * Supports multiple output formats for synthetic data generation.
 */
import type { 
  StoredMessage, 
  ContentBlock, 
  TextContent, 
  ThinkingContent, 
  ToolUseContent, 
  ToolResultContent,
  Attachment 
} from '$lib/types';
import { db } from '$lib/db';

export type ExportFormat = 'openai' | 'anthropic' | 'markdown' | 'custom';
export type MultiTurnMode = 'single' | 'multiple' | 'system-turns' | 'split';

export interface ExportConfig {
  format: ExportFormat;
  multiTurnMode: MultiTurnMode;
  includeFields: {
    uuid: boolean;
    timestamps: boolean;
    thinking: boolean;
    toolCalls: boolean;
  };
}

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type AnthropicContentBlock = 
  | { type: 'text'; text: string; citations?: unknown[] }
  | { type: 'thinking'; thinking: string; signature?: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | AnthropicToolResultContent[]; is_error?: boolean }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'text'; media_type: string; data: string } };

type AnthropicToolResultContent = 
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'text'; media_type: string; data: string } };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContentBlock[];
}

interface CustomMessage {
  role: 'user' | 'assistant';
  content: string;
  uuid?: string;
  created_at?: string;
  thinking?: string;
  tool_calls?: Array<{ name: string; input: unknown }>;
}

interface SplitExample {
  input: string;
  output: string;
}

interface SystemTurnsFormat {
  system: string;
  messages: OpenAIMessage[];
}

class ToolIdTracker {
  private counter = 0;
  private pendingToolUseIds: Map<string, string[]> = new Map();

  generateId(): string {
    return `toolu_${String(++this.counter).padStart(3, '0')}`;
  }

  registerToolUse(name: string, id: string): void {
    const ids = this.pendingToolUseIds.get(name) || [];
    ids.push(id);
    this.pendingToolUseIds.set(name, ids);
  }

  getToolUseId(name: string): string | null {
    const ids = this.pendingToolUseIds.get(name);
    if (ids && ids.length > 0) {
      return ids.shift() || null;
    }
    return null;
  }
}

async function getEditedText(messageUuid: string, originalText: string): Promise<string> {
  try {
    const edit = await db.edits.where('messageUuid').equals(messageUuid).first();
    return edit?.currentText ?? originalText;
  } catch {
    return originalText;
  }
}

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is TextContent => b.type === 'text')
    .map(b => b.text)
    .join('\n\n');
}

function extractThinking(content: ContentBlock[]): string | undefined {
  const thinking = content
    .filter((b): b is ThinkingContent => b.type === 'thinking')
    .map(b => b.thinking)
    .join('\n\n');
  return thinking || undefined;
}

function extractToolCalls(content: ContentBlock[]): Array<{ name: string; input: unknown }> | undefined {
  const calls = content
    .filter((b): b is ToolUseContent => b.type === 'tool_use')
    .map(b => ({ name: b.name, input: b.input }));
  return calls.length > 0 ? calls : undefined;
}

function mapRole(sender: 'human' | 'assistant'): 'user' | 'assistant' {
  return sender === 'human' ? 'user' : 'assistant';
}

function getMediaType(fileType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp',
    'application/pdf': 'application/pdf',
    'text/plain': 'text/plain',
    'text/markdown': 'text/markdown',
    'text/csv': 'text/csv',
  };
  return typeMap[fileType] || 'text/plain';
}

function isImageType(fileType: string): boolean {
  return fileType.startsWith('image/');
}

function formatAttachmentForAnthropic(attachment: Attachment): AnthropicContentBlock {
  const mediaType = getMediaType(attachment.file_type);
  
  if (isImageType(attachment.file_type)) {
    const base64Match = attachment.extracted_content?.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (base64Match) {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Match[1]
        }
      };
    }
  }
  
  return {
    type: 'text',
    text: `[Attachment: ${attachment.file_name}]\n\n${attachment.extracted_content || '(No content extracted)'}`
  };
}

function formatTextBlockForAnthropic(block: TextContent): AnthropicContentBlock {
  const result: AnthropicContentBlock = {
    type: 'text',
    text: block.text
  };
  
  if (block.citations && block.citations.length > 0) {
    (result as { type: 'text'; text: string; citations: unknown[] }).citations = block.citations;
  }
  
  return result;
}

function formatThinkingBlockForAnthropic(block: ThinkingContent): AnthropicContentBlock {
  const result: { type: 'thinking'; thinking: string; signature?: string } = {
    type: 'thinking',
    thinking: block.thinking
  };
  
  const blockWithSignature = block as ThinkingContent & { signature?: string };
  if (blockWithSignature.signature) {
    result.signature = blockWithSignature.signature;
  }
  
  return result;
}

function formatToolUseBlockForAnthropic(block: ToolUseContent, tracker: ToolIdTracker): AnthropicContentBlock {
  const id = tracker.generateId();
  tracker.registerToolUse(block.name, id);
  
  return {
    type: 'tool_use',
    id,
    name: block.name,
    input: block.input
  };
}

function formatToolResultBlockForAnthropic(block: ToolResultContent, tracker: ToolIdTracker): AnthropicContentBlock | null {
  const toolUseId = tracker.getToolUseId(block.name);
  if (!toolUseId) {
    return null;
  }
  
  let content: string | AnthropicToolResultContent[];
  
  if (block.content.length === 0) {
    content = '';
  } else if (block.content.length === 1 && block.content[0].type === 'text' && block.content[0].text) {
    content = block.content[0].text;
  } else {
    content = block.content
      .filter(item => item.text || item.title || item.url)
      .map(item => {
        if (item.text) {
          return { type: 'text' as const, text: item.text };
        }
        if (item.title && item.url) {
          return { type: 'text' as const, text: `[${item.title}](${item.url})` };
        }
        return { type: 'text' as const, text: JSON.stringify(item) };
      });
    
    if (content.length === 0) {
      content = '';
    }
  }
  
  const result: AnthropicContentBlock = {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content
  };
  
  if (block.is_error) {
    (result as { type: 'tool_result'; tool_use_id: string; content: string | AnthropicToolResultContent[]; is_error: boolean }).is_error = true;
  }
  
  return result;
}

function formatContentBlockForAnthropic(
  block: ContentBlock, 
  tracker: ToolIdTracker
): AnthropicContentBlock | null {
  switch (block.type) {
    case 'text':
      return formatTextBlockForAnthropic(block);
    case 'thinking':
      return formatThinkingBlockForAnthropic(block);
    case 'tool_use':
      return formatToolUseBlockForAnthropic(block, tracker);
    case 'tool_result':
      return formatToolResultBlockForAnthropic(block, tracker);
    case 'token_budget':
      return null;
    default:
      return null;
  }
}

async function formatAnthropic(messages: StoredMessage[]): Promise<AnthropicMessage[]> {
  const result: AnthropicMessage[] = [];
  const tracker = new ToolIdTracker();
  
  for (const msg of messages) {
    const role = mapRole(msg.sender);
    const contentBlocks: AnthropicContentBlock[] = [];
    
    if (role === 'user' && msg.attachments && msg.attachments.length > 0) {
      for (const attachment of msg.attachments) {
        contentBlocks.push(formatAttachmentForAnthropic(attachment));
      }
    }
    
    for (const block of msg.content) {
      const formatted = formatContentBlockForAnthropic(block, tracker);
      if (formatted) {
        if (formatted.type === 'text') {
          const originalText = (block as TextContent).text;
          const editedText = await getEditedText(msg.uuid, originalText);
          if (editedText !== originalText) {
            (formatted as { type: 'text'; text: string }).text = editedText;
          }
        }
        contentBlocks.push(formatted);
      }
    }
    
    if (contentBlocks.length > 0) {
      if (role === 'user') {
        const toolResults = contentBlocks.filter(b => b.type === 'tool_result');
        const otherBlocks = contentBlocks.filter(b => b.type !== 'tool_result');
        result.push({
          role,
          content: [...toolResults, ...otherBlocks]
        });
      } else {
        result.push({
          role,
          content: contentBlocks
        });
      }
    }
  }
  
  return result;
}

async function formatOpenAI(messages: StoredMessage[]): Promise<OpenAIMessage[]> {
  const result: OpenAIMessage[] = [];
  for (const msg of messages) {
    const text = await getEditedText(msg.uuid, extractText(msg.content));
    result.push({
      role: mapRole(msg.sender),
      content: text
    });
  }
  return result;
}

async function formatMarkdownMessages(messages: StoredMessage[]): Promise<string> {
  const sections: string[] = [];

  for (const msg of messages) {
    const text = await getEditedText(msg.uuid, extractText(msg.content));
    const role = mapRole(msg.sender) === 'user' ? 'User' : 'Assistant';
    sections.push(`### ${role}\n\n${text || '(empty)'}`);
  }

  if (sections.length === 0) {
    return '(no messages)';
  }

  return sections.join('\n\n---\n\n');
}

async function formatCustom(
  messages: StoredMessage[],
  includeFields: ExportConfig['includeFields']
): Promise<CustomMessage[]> {
  const result: CustomMessage[] = [];
  for (const msg of messages) {
    const text = await getEditedText(msg.uuid, extractText(msg.content));
    const entry: CustomMessage = {
      role: mapRole(msg.sender),
      content: text
    };
    if (includeFields.uuid) entry.uuid = msg.uuid;
    if (includeFields.timestamps) entry.created_at = msg.createdAt;
    if (includeFields.thinking) entry.thinking = extractThinking(msg.content);
    if (includeFields.toolCalls) entry.tool_calls = extractToolCalls(msg.content);
    result.push(entry);
  }
  return result;
}

async function applyMultiTurnMode(
  messagesByConversation: Map<string, StoredMessage[]>,
  config: ExportConfig
): Promise<unknown> {
  const allMessages: StoredMessage[] = [];
  for (const msgs of messagesByConversation.values()) {
    allMessages.push(...msgs);
  }

  switch (config.multiTurnMode) {
    case 'single': {
      return formatMessages(allMessages, config);
    }

    case 'multiple': {
      if (config.format === 'markdown') {
        const snippets: string[] = [];
        let index = 1;

        for (const [conversationUuid, msgs] of messagesByConversation) {
          const formatted = await formatMarkdownMessages(msgs);
          snippets.push(`## Conversation ${index}\n\nConversation UUID: ${conversationUuid}\n\n${formatted}`);
          index++;
        }

        return snippets.join('\n\n\n');
      }

      const snippets: unknown[] = [];
      for (const msgs of messagesByConversation.values()) {
        snippets.push(await formatMessages(msgs, config));
      }
      return snippets;
    }

    case 'system-turns': {
      if (config.format === 'markdown') {
        if (allMessages.length === 0) return '## System\n\n\n## Messages\n\n(no messages)';

        const [first, ...rest] = allMessages;
        const systemText = await getEditedText(first.uuid, extractText(first.content));
        const formattedMessages = await formatMarkdownMessages(rest);

        return `## System\n\n${systemText || '(empty)'}\n\n## Messages\n\n${formattedMessages}`;
      }

      if (allMessages.length === 0) return { system: '', messages: [] };
      
      const [first, ...rest] = allMessages;
      const systemText = await getEditedText(first.uuid, extractText(first.content));
      const formatted = await formatMessages(rest, { ...config, format: 'openai' }) as OpenAIMessage[];
      
      return {
        system: systemText,
        messages: formatted
      } as SystemTurnsFormat;
    }

    case 'split': {
      if (config.format === 'markdown') {
        const examples: string[] = [];
        let exampleCount = 1;

        for (let i = 0; i < allMessages.length - 1; i += 2) {
          const human = allMessages[i];
          const assistant = allMessages[i + 1];

          if (human?.sender === 'human' && assistant?.sender === 'assistant') {
            const input = await getEditedText(human.uuid, extractText(human.content));
            const output = await getEditedText(assistant.uuid, extractText(assistant.content));

            examples.push(
              `### Example ${exampleCount}\n\n**Input**\n\n${input || '(empty)'}\n\n**Output**\n\n${output || '(empty)'}`
            );
            exampleCount++;
          }
        }

        return examples.length > 0 ? examples.join('\n\n---\n\n') : '(no split pairs found)';
      }

      const examples: SplitExample[] = [];
      for (let i = 0; i < allMessages.length - 1; i += 2) {
        const human = allMessages[i];
        const assistant = allMessages[i + 1];
        if (human?.sender === 'human' && assistant?.sender === 'assistant') {
          const input = await getEditedText(human.uuid, extractText(human.content));
          const output = await getEditedText(assistant.uuid, extractText(assistant.content));
          examples.push({ input, output });
        }
      }
      return examples;
    }

    default:
      return formatMessages(allMessages, config);
  }
}

async function formatMessages(
  messages: StoredMessage[],
  config: ExportConfig
): Promise<unknown> {
  switch (config.format) {
    case 'openai':
      return formatOpenAI(messages);
    case 'anthropic':
      return formatAnthropic(messages);
    case 'markdown':
      return formatMarkdownMessages(messages);
    case 'custom':
      return formatCustom(messages, config.includeFields);
    default:
      return formatOpenAI(messages);
  }
}

export async function generateExport(
  messagesByConversation: Map<string, StoredMessage[]>,
  config: ExportConfig
): Promise<unknown> {
  return applyMultiTurnMode(messagesByConversation, config);
}

export async function generatePreview(
  messagesByConversation: Map<string, StoredMessage[]>,
  config: ExportConfig,
  maxMessages: number = 3
): Promise<string> {
  const limitedMap = new Map<string, StoredMessage[]>();
  let count = 0;
  
  for (const [convId, msgs] of messagesByConversation) {
    const limited: StoredMessage[] = [];
    for (const msg of msgs) {
      if (count >= maxMessages) break;
      limited.push(msg);
      count++;
    }
    if (limited.length > 0) {
      limitedMap.set(convId, limited);
    }
    if (count >= maxMessages) break;
  }

  const data = await generateExport(limitedMap, config);

  if (config.format === 'markdown') {
    return typeof data === 'string' ? data : String(data);
  }

  return JSON.stringify(data, null, 2);
}

export function downloadExport(data: unknown, format: ExportFormat, filename?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const isMarkdown = format === 'markdown';
  const extension = isMarkdown ? 'md' : 'json';
  const content = isMarkdown ? String(data) : JSON.stringify(data, null, 2);
  const mimeType = isMarkdown ? 'text/markdown' : 'application/json';
  const name = filename || `claude-export-${timestamp}.${extension}`;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
