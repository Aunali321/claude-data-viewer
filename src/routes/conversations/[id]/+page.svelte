<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { db, hideConversation } from '$lib/db';
	import MessageItem from '$lib/components/conversation/MessageItem.svelte';
	import ExportModal from '$lib/components/export/ExportModal.svelte';
	import type { StoredConversation, StoredMessage, ExportRecord, ArtifactInput, ToolUseContent } from '$lib/types';
	import {
		selectedCount,
		selectedMessages,
		addToSelection,
		removeFromSelection,
		selectAll as storeSelectAll,
		selectRange,
		clearSelection,
		invertSelection as storeInvertSelection,
		isSelected
	} from '$lib/stores/selection';

	let conversationId = $derived($page.params.id);
	let conversation = $state<StoredConversation | null>(null);
	let messages = $state<StoredMessage[]>([]);
	let exportRecord = $state<ExportRecord | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let lastSelectedIndex = $state<number | null>(null);
	let showExportModal = $state(false);

	let artifactVersions = $derived(() => {
		const artifactMap = new Map<string, ArtifactInput[]>();

		for (const msg of messages) {
			for (const block of msg.content) {
				if (block.type === 'tool_use' && (block as ToolUseContent).name === 'artifacts') {
					const input = (block as ToolUseContent).input as unknown as ArtifactInput;
					if (input?.id) {
						const existing = artifactMap.get(input.id) || [];
						existing.push(input);
						artifactMap.set(input.id, existing);
					}
				}
			}
		}

		return artifactMap;
	});

	async function loadConversation() {
		isLoading = true;
		error = null;

		if (!conversationId) {
			error = 'No conversation ID provided';
			isLoading = false;
			return;
		}

		try {
			const conv = await db.conversations.get(conversationId);
			if (!conv) {
				error = 'Conversation not found';
				return;
			}
			conversation = conv;

			const exp = await db.exports.get(conv.exportId);
			exportRecord = exp ?? null;

			messages = await db.messages
				.where('conversationUuid')
				.equals(conversationId)
				.sortBy('index');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load conversation';
		} finally {
			isLoading = false;
		}
	}

	function goBack() {
		goto('/conversations');
	}

	async function handleHideConversation() {
		if (!conversation) return;
		if (!confirm('Hide this conversation? You can show it again from the filters.')) return;

		await hideConversation(conversation.uuid, true);
		goto('/conversations');
	}

	function toggleSelection(message: StoredMessage, index: number, shiftKey: boolean) {
		if (!conversation) return;

		if (shiftKey && lastSelectedIndex !== null) {
			selectRange(messages, lastSelectedIndex, index, conversation.uuid, conversation.name);
		} else {
			if (isSelected(message.uuid)) {
				removeFromSelection(message.uuid);
			} else {
				addToSelection(message, conversation.uuid, conversation.name);
			}
			lastSelectedIndex = index;
		}
	}

	function selectAll() {
		if (!conversation) return;
		storeSelectAll(messages, conversation.uuid, conversation.name);
	}

	function deselectAll() {
		clearSelection();
		lastSelectedIndex = null;
	}

	function invertSelection() {
		if (!conversation) return;
		storeInvertSelection(messages, conversation.uuid, conversation.name);
	}

	function openExportModal() {
		showExportModal = true;
	}

	function closeExportModal() {
		showExportModal = false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (showExportModal) return;

		if (e.ctrlKey || e.metaKey) {
			if (e.key === 'a') {
				e.preventDefault();
				selectAll();
			}
		}
		if (e.key === 'Escape') {
			deselectAll();
		}
	}

	$effect(() => {
		if (conversationId) {
			loadConversation();
		}
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="page">
	<!-- Top bar -->
	<header class="topbar">
		<div class="topbar-left">
			<button class="back-btn" onclick={goBack}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>Back</span>
			</button>
			{#if conversation}
				<h1 class="title">{conversation.name}</h1>
			{/if}
		</div>

		<div class="topbar-right">
			<div class="selection-controls">
				{#if $selectedCount > 0}
					<span class="selection-count">{$selectedCount} selected</span>
					<button class="text-btn" onclick={invertSelection}>Invert</button>
					<button class="text-btn" onclick={deselectAll}>Clear</button>
					<button class="primary-btn" onclick={openExportModal}>Export</button>
				{:else}
					<button class="text-btn" onclick={selectAll}>Select All</button>
				{/if}
			</div>
			{#if conversation}
				<button class="icon-btn" onclick={handleHideConversation} title="Hide conversation">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M1 1l22 22" stroke-linecap="round"/>
					</svg>
				</button>
			{/if}
		</div>
	</header>

	<!-- Messages -->
	<main class="content">
		{#if isLoading}
			<div class="center-state">
				<div class="spinner"></div>
			</div>
		{:else if error}
			<div class="center-state">
				<p class="error-text">{error}</p>
				<button class="primary-btn" onclick={goBack}>Go Back</button>
			</div>
		{:else}
			<div class="messages">
				{#each messages as message, index (message.uuid)}
					<MessageItem
						{message}
						isSelected={isSelected(message.uuid)}
						onToggleSelect={(shiftKey) => toggleSelection(message, index, shiftKey)}
						artifactVersionsMap={artifactVersions()}
					/>
				{/each}
			</div>
		{/if}
	</main>
</div>

{#if showExportModal}
	<ExportModal onClose={closeExportModal} />
{/if}

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: var(--cdv-color-bg-base);
	}

	/* Top bar - minimal like Claude.ai */
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--cdv-space-3) var(--cdv-space-5);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
		background-color: var(--cdv-color-bg-base);
		position: sticky;
		top: 0;
		z-index: var(--cdv-z-sticky);
	}

	.topbar-left {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		min-width: 0;
		flex: 1;
	}

	.topbar-right {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		flex-shrink: 0;
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		background: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-full);
		color: var(--cdv-color-text-secondary);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: var(--cdv-shadow-sm);
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.back-btn:hover {
		background: var(--cdv-color-surface-primary);
		border-color: var(--cdv-color-border-default);
		color: var(--cdv-color-text-primary);
		box-shadow: var(--cdv-shadow-md);
	}

	.title {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.selection-controls {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
	}

	.selection-count {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		padding-right: var(--cdv-space-2);
		border-right: 1px solid var(--cdv-color-border-subtle);
	}

	.text-btn {
		padding: var(--cdv-space-1) var(--cdv-space-2);
		background: transparent;
		border: none;
		border-radius: var(--cdv-radius-md);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		cursor: pointer;
	}

	.text-btn:hover {
		color: var(--cdv-color-text-primary);
		background-color: var(--cdv-color-bg-hover);
	}

	.primary-btn {
		padding: var(--cdv-space-1-5) var(--cdv-space-4);
		background-color: var(--cdv-color-brand-500);
		border: none;
		border-radius: var(--cdv-radius-lg);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: white;
		cursor: pointer;
	}

	.primary-btn:hover {
		background-color: var(--cdv-color-brand-600);
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: transparent;
		border: none;
		border-radius: var(--cdv-radius-md);
		color: var(--cdv-color-text-tertiary);
		cursor: pointer;
	}

	.icon-btn:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}

	/* Content area */
	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.center-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-4);
		padding: var(--cdv-space-16);
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--cdv-color-border-subtle);
		border-top-color: var(--cdv-color-brand-500);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-text {
		color: var(--cdv-color-text-secondary);
		margin: 0;
	}

	/* Messages container */
	.messages {
		max-width: 768px;
		width: 100%;
		margin: 0 auto;
		padding: var(--cdv-space-8) var(--cdv-space-5);
		padding-bottom: var(--cdv-space-20);
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-6);
	}

	@media (max-width: 768px) {
		.topbar {
			padding: var(--cdv-space-2) var(--cdv-space-3);
		}

		.messages {
			padding: var(--cdv-space-4) var(--cdv-space-3);
		}
	}
</style>
