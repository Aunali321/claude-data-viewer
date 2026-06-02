<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { exports, currentExportId, filters, sidebarCollapsed } from '$lib/stores/app';
	import { selectAll as selectAllMessages, clearSelection } from '$lib/stores/selection';
	import Header from '$lib/components/layout/Header.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import ExportModal from '$lib/components/export/ExportModal.svelte';
	import type { StoredConversation, FilterState, StoredMessage } from '$lib/types';
	import { formatRelativeDate } from '$lib/utils/format';
	import { onMount } from 'svelte';

	let conversations = $state<StoredConversation[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');

	let selectedConversations = $state<Set<string>>(new Set());
	let showExportModal = $state(false);
	let isLoadingExport = $state(false);

	let filteredConversations = $derived.by(() => {
		let result = [...conversations];

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(c => c.name.toLowerCase().includes(query));
		}

		const f = $filters;
		
		if (!f.showHidden) {
			result = result.filter(c => !c.isHidden);
		}
		
		if (!f.showEmpty) {
			result = result.filter(c => c.messageCount > 0);
		}
		
		if (f.hasAttachments === true) {
			result = result.filter(c => c.hasAttachments);
		}
		
		if (f.hasArtifacts === true) {
			result = result.filter(c => c.hasArtifacts);
		}
		
		if (f.hasCode === true) {
			result = result.filter(c => c.hasCode);
		}

		switch (f.sortBy) {
			case 'date-desc':
				result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
				break;
			case 'date-asc':
				result.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
				break;
			case 'messages':
				result.sort((a, b) => b.messageCount - a.messageCount);
				break;
			case 'name':
				result.sort((a, b) => a.name.localeCompare(b.name));
				break;
		}
		
		return result;
	});
	
	async function loadConversations() {
		isLoading = true;
		try {
			const exportId = $currentExportId;
			if (exportId) {
				conversations = await db.conversations
					.where('exportId')
					.equals(exportId)
					.toArray();
			} else {
				conversations = await db.conversations.toArray();
			}
		} catch (error) {
			console.error('Failed to load conversations:', error);
		} finally {
			isLoading = false;
		}
	}
	
	function openConversation(uuid: string) {
		goto(`/conversations/${uuid}`);
	}

	function handleKeyDown(e: KeyboardEvent, uuid: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openConversation(uuid);
		}
	}

	function toggleConversationSelection(uuid: string, e: MouseEvent) {
		e.stopPropagation();
		selectedConversations = new Set(selectedConversations);
		if (selectedConversations.has(uuid)) {
			selectedConversations.delete(uuid);
		} else {
			selectedConversations.add(uuid);
		}
	}

	function selectAllConversations() {
		selectedConversations = new Set(filteredConversations.map(c => c.uuid));
	}

	function clearConversationSelection() {
		selectedConversations = new Set();
	}

	async function openExportModal() {
		if (selectedConversations.size === 0) return;

		isLoadingExport = true;
		clearSelection();

		try {
			for (const convId of selectedConversations) {
				const conv = conversations.find(c => c.uuid === convId);
				if (!conv) continue;

				const messages = await db.messages
					.where('conversationUuid')
					.equals(convId)
					.sortBy('index');

				selectAllMessages(messages, conv.uuid, conv.name);
			}

			showExportModal = true;
		} catch (error) {
			console.error('Failed to load messages for export:', error);
		} finally {
			isLoadingExport = false;
		}
	}

	function closeExportModal() {
		showExportModal = false;
		clearConversationSelection();
	}

	function handleGlobalKeyDown(e: KeyboardEvent) {
		if (showExportModal) return;

		if (e.ctrlKey || e.metaKey) {
			if (e.key === 'a') {
				e.preventDefault();
				selectAllConversations();
			}
		}
		if (e.key === 'Escape') {
			clearConversationSelection();
		}
	}

	onMount(() => {
		loadConversations();
	});

	$effect(() => {
		if ($currentExportId !== undefined) {
			loadConversations();
		}
	});
</script>

<svelte:window onkeydown={handleGlobalKeyDown} />

<div class="page-container" class:sidebar-collapsed={$sidebarCollapsed}>
	<Sidebar />
	
	<div class="main-area">
		<Header />
		
		<div class="content">
			<div class="content-header">
				<div class="search-container">
					<svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" stroke-linecap="round" />
					</svg>
					<input
						type="text"
						class="search-input"
						placeholder="Search conversations..."
						bind:value={searchQuery}
					/>
				</div>

				<div class="header-right">
					<div class="selection-controls">
						{#if selectedConversations.size > 0}
							<span class="selection-count">{selectedConversations.size} selected</span>
							<button class="text-btn" onclick={clearConversationSelection}>Clear</button>
							<button class="primary-btn" onclick={openExportModal} disabled={isLoadingExport}>
								{#if isLoadingExport}
									<span class="btn-spinner"></span>
								{/if}
								Export
							</button>
						{:else}
							<button class="text-btn" onclick={selectAllConversations}>Select All</button>
						{/if}
					</div>

					<div class="stats">
						<span class="stat-count">{filteredConversations.length}</span>
						<span class="stat-label">conversations</span>
					</div>
				</div>
			</div>
			
			{#if isLoading}
				<div class="loading-state">
					<div class="loading-spinner"></div>
					<p>Loading conversations...</p>
				</div>
			{:else if filteredConversations.length === 0}
				<div class="empty-state">
					{#if conversations.length === 0}
						<p>No conversations found.</p>
						<a href="/" class="btn btn-primary">Import Data</a>
					{:else}
						<p>No conversations match your filters.</p>
						<button class="btn btn-secondary" onclick={() => { searchQuery = ''; }}>
							Clear Search
						</button>
					{/if}
				</div>
			{:else}
				<ul class="conversation-list">
					{#each filteredConversations as conv (conv.uuid)}
						<li class="conversation-row" class:selected={selectedConversations.has(conv.uuid)}>
							<button
								class="conversation-item"
								onclick={() => openConversation(conv.uuid)}
								onkeydown={(e) => handleKeyDown(e, conv.uuid)}
							>
								<div class="conv-main">
									<h3 class="conv-name">{conv.name}</h3>
									<div class="conv-meta">
										<span class="conv-date">{formatRelativeDate(conv.updatedAt)}</span>
										<span class="conv-messages">{conv.messageCount} msgs</span>
									</div>
								</div>

								<div class="conv-badges">
									{#if conv.hasAttachments}
										<span class="badge" title="Has attachments">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
										</span>
									{/if}
									{#if conv.hasArtifacts}
										<span class="badge" title="Has artifacts">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
												<line x1="3" y1="9" x2="21" y2="9" stroke-linecap="round"/>
												<line x1="9" y1="21" x2="9" y2="9" stroke-linecap="round"/>
											</svg>
										</span>
									{/if}
									{#if conv.hasCode}
										<span class="badge" title="Has code">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<polyline points="16,18 22,12 16,6" stroke-linecap="round" stroke-linejoin="round"/>
												<polyline points="8,6 2,12 8,18" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
										</span>
									{/if}
									{#if conv.hasThinking}
										<span class="badge" title="Has extended thinking">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<circle cx="12" cy="12" r="10"/>
												<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>
												<line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round"/>
											</svg>
										</span>
									{/if}
									{#if conv.isHidden}
										<span class="badge badge-warning" title="Hidden">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke-linecap="round" stroke-linejoin="round"/>
												<line x1="1" y1="1" x2="23" y2="23" stroke-linecap="round"/>
											</svg>
										</span>
									{/if}
								</div>
								
								<svg class="conv-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="9,18 15,12 9,6" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</button>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<label class="conv-checkbox" onclick={(e) => e.stopPropagation()}>
								<input
									type="checkbox"
									checked={selectedConversations.has(conv.uuid)}
									onclick={(e) => toggleConversationSelection(conv.uuid, e)}
								/>
								<span class="checkbox-icon">
									{#if selectedConversations.has(conv.uuid)}
										<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
											<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
										</svg>
									{/if}
								</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

{#if showExportModal}
	<ExportModal onClose={closeExportModal} />
{/if}

<style>
	.page-container {
		display: flex;
		min-height: 100vh;
		background-color: var(--cdv-color-bg-base);
	}

	.main-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		margin-left: var(--cdv-sidebar-width);
		transition: margin-left var(--cdv-transition-slow) var(--cdv-ease-default);
	}

	.page-container.sidebar-collapsed .main-area {
		margin-left: 0;
	}

	.content {
		flex: 1;
		padding: var(--cdv-space-6);
		max-width: 1200px;
		width: 100%;
		margin: 0 auto;
	}

	.content-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--cdv-space-4);
		margin-bottom: var(--cdv-space-6);
	}

	.search-container {
		position: relative;
		flex: 1;
		max-width: 400px;
	}

	.search-icon {
		position: absolute;
		left: var(--cdv-space-3);
		top: 50%;
		transform: translateY(-50%);
		color: var(--cdv-color-text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: var(--cdv-space-2-5) var(--cdv-space-3) var(--cdv-space-2-5) var(--cdv-space-10);
		font-size: var(--cdv-font-size-sm);
		background-color: var(--cdv-color-bg-raised);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-lg);
		color: var(--cdv-color-text-primary);
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.search-input:hover {
		border-color: var(--cdv-color-border-default);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--cdv-color-brand-500);
		box-shadow: var(--cdv-ring-focus);
	}

	.search-input::placeholder {
		color: var(--cdv-color-text-tertiary);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-4);
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
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-1-5) var(--cdv-space-4);
		background-color: var(--cdv-color-brand-500);
		border: none;
		border-radius: var(--cdv-radius-lg);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: white;
		cursor: pointer;
	}

	.primary-btn:hover:not(:disabled) {
		background-color: var(--cdv-color-brand-600);
	}

	.primary-btn:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.btn-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.stats {
		display: flex;
		align-items: baseline;
		gap: var(--cdv-space-1-5);
	}

	.stat-count {
		font-size: var(--cdv-font-size-xl);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-primary);
	}

	.stat-label {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-4);
		padding: var(--cdv-space-16);
		color: var(--cdv-color-text-secondary);
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--cdv-color-border-subtle);
		border-top-color: var(--cdv-color-brand-500);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.conversation-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-2);
	}

	.conversation-row {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
	}

	.conv-checkbox {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		cursor: pointer;
		opacity: 0;
		transition: opacity var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.conversation-row:hover .conv-checkbox,
	.conversation-row.selected .conv-checkbox {
		opacity: 1;
	}

	.conv-checkbox input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.conv-checkbox .checkbox-icon {
		width: 18px;
		height: 18px;
		border: 2px solid var(--cdv-color-border-default);
		border-radius: var(--cdv-radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
		color: white;
	}

	.conv-checkbox:hover .checkbox-icon {
		border-color: var(--cdv-color-brand-500);
	}

	.conv-checkbox input:checked + .checkbox-icon {
		background-color: var(--cdv-color-brand-500);
		border-color: var(--cdv-color-brand-500);
	}

	.conversation-row.selected .conversation-item {
		border-color: var(--cdv-color-brand-400);
		box-shadow: 0 0 0 1px var(--cdv-color-brand-400);
	}

	.conversation-item {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-4);
		flex: 1;
		min-width: 0;
		padding: var(--cdv-space-4);
		background-color: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-xl);
		cursor: pointer;
		text-align: left;
		box-shadow: var(--cdv-shadow-xs);
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.conversation-item:hover {
		background-color: var(--cdv-color-surface-primary);
		border-color: var(--cdv-color-border-default);
		box-shadow: var(--cdv-shadow-md);
		transform: translateY(-1px);
	}

	.conversation-item:focus-visible {
		outline: none;
		border-color: var(--cdv-color-brand-500);
		box-shadow: var(--cdv-ring-focus);
	}

	.conv-main {
		flex: 1;
		min-width: 0;
	}

	.conv-name {
		font-size: var(--cdv-font-size-base);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
		margin: 0 0 var(--cdv-space-1) 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.conv-meta {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
	}

	.conv-date,
	.conv-messages {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}

	.conv-badges {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-1-5);
	}

	.badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background-color: var(--cdv-color-bg-muted);
		border-radius: var(--cdv-radius-lg);
		color: var(--cdv-color-text-secondary);
	}

	.badge svg {
		width: 18px;
		height: 18px;
	}

	.badge-warning {
		background-color: var(--cdv-color-warning-100);
		color: var(--cdv-color-warning-600);
	}

	.conv-arrow {
		color: var(--cdv-color-text-tertiary);
		opacity: 0;
		transition: opacity var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.conversation-item:hover .conv-arrow {
		opacity: 1;
	}

	@media (max-width: 768px) {
		.main-area {
			margin-left: 0;
		}

		.content {
			padding: var(--cdv-space-4);
		}

		.content-header {
			flex-direction: column;
			align-items: stretch;
		}

		.header-right {
			flex-direction: row-reverse;
			justify-content: space-between;
		}

		.search-container {
			max-width: none;
		}

		.stats {
			justify-content: center;
		}

		.conv-checkbox {
			opacity: 1;
		}

		.conv-badges {
			display: none;
		}
	}
</style>
