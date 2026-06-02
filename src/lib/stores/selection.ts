/**
 * Global selection store for tracking selected messages across conversations.
 * Supports multi-conversation selection for batch export operations.
 */
import { writable, derived, get } from 'svelte/store';
import type { StoredMessage } from '$lib/types';

export interface SelectedMessage {
  message: StoredMessage;
  conversationId: string;
  conversationName: string;
}

const selectedMessagesMap = writable<Map<string, SelectedMessage>>(new Map());

export const selectedMessages = derived(
  selectedMessagesMap,
  $map => Array.from($map.values())
);

export const selectedCount = derived(
  selectedMessagesMap,
  $map => $map.size
);

export const selectedByConversation = derived(
  selectedMessagesMap,
  $map => {
    const grouped = new Map<string, { name: string; messages: StoredMessage[] }>();
    for (const item of $map.values()) {
      if (!grouped.has(item.conversationId)) {
        grouped.set(item.conversationId, { name: item.conversationName, messages: [] });
      }
      grouped.get(item.conversationId)!.messages.push(item.message);
    }
    for (const group of grouped.values()) {
      group.messages.sort((a, b) => a.index - b.index);
    }
    return grouped;
  }
);

export function addToSelection(
  message: StoredMessage,
  conversationId: string,
  conversationName: string
): void {
  selectedMessagesMap.update(map => {
    const newMap = new Map(map);
    newMap.set(message.uuid, { message, conversationId, conversationName });
    return newMap;
  });
}

export function removeFromSelection(messageId: string): void {
  selectedMessagesMap.update(map => {
    const newMap = new Map(map);
    newMap.delete(messageId);
    return newMap;
  });
}

export function toggleSelection(
  message: StoredMessage,
  conversationId: string,
  conversationName: string
): void {
  const map = get(selectedMessagesMap);
  if (map.has(message.uuid)) {
    removeFromSelection(message.uuid);
  } else {
    addToSelection(message, conversationId, conversationName);
  }
}

export function isSelected(messageId: string): boolean {
  return get(selectedMessagesMap).has(messageId);
}

export function clearSelection(): void {
  selectedMessagesMap.set(new Map());
}

export function selectAll(
  messages: StoredMessage[],
  conversationId: string,
  conversationName: string
): void {
  selectedMessagesMap.update(map => {
    const newMap = new Map(map);
    for (const message of messages) {
      newMap.set(message.uuid, { message, conversationId, conversationName });
    }
    return newMap;
  });
}

export function selectRange(
  messages: StoredMessage[],
  startIndex: number,
  endIndex: number,
  conversationId: string,
  conversationName: string
): void {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);
  
  selectedMessagesMap.update(map => {
    const newMap = new Map(map);
    for (let i = start; i <= end; i++) {
      const message = messages[i];
      newMap.set(message.uuid, { message, conversationId, conversationName });
    }
    return newMap;
  });
}

export function invertSelection(
  messages: StoredMessage[],
  conversationId: string,
  conversationName: string
): void {
  selectedMessagesMap.update(map => {
    const newMap = new Map(map);
    for (const message of messages) {
      if (newMap.has(message.uuid)) {
        newMap.delete(message.uuid);
      } else {
        newMap.set(message.uuid, { message, conversationId, conversationName });
      }
    }
    return newMap;
  });
}
