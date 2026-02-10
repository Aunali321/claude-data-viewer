<script lang="ts">
	import type { StoredMessage, EditRecord } from '$lib/types';
	import { getEditForMessage, saveEdit, revertEdit } from '$lib/db';
	import DiffView from './DiffView.svelte';
	import EditHistory from './EditHistory.svelte';
	
	interface Props {
		message: StoredMessage;
		onClose: () => void;
		onSave: () => void;
	}
	
	let { message, onClose, onSave }: Props = $props();
	
	let editRecord = $state<EditRecord | null>(null);
	let editText = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let showDiff = $state(false);
	let showHistory = $state(false);
	
	// Get original text from message content blocks
	function getOriginalText(): string {
		return message.content
			.filter(b => b.type === 'text')
			.map(b => (b as { text: string }).text)
			.join('\n\n');
	}
	
	let originalText = $derived(getOriginalText());
	let currentText = $derived(editRecord?.currentText ?? originalText);
	let hasChanges = $derived(editText !== currentText);
	let hasEdits = $derived(editRecord !== null);
	
	async function loadEdit() {
		isLoading = true;
		try {
			const existing = await getEditForMessage(message.uuid);
			editRecord = existing ?? null;
			editText = existing?.currentText ?? originalText;
		} finally {
			isLoading = false;
		}
	}
	
	async function handleSave() {
		if (!hasChanges) return;
		
		isSaving = true;
		try {
			await saveEdit(message.uuid, originalText, editText);
			// Reload the edit record
			const updated = await getEditForMessage(message.uuid);
			editRecord = updated ?? null;
			onSave();
		} finally {
			isSaving = false;
		}
	}
	
	async function handleRevert() {
		if (!confirm('Revert to original? This will delete all edit history.')) return;
		
		isSaving = true;
		try {
			await revertEdit(message.uuid);
			editRecord = null;
			editText = originalText;
			onSave();
		} finally {
			isSaving = false;
		}
	}
	
	function handleCancel() {
		if (hasChanges) {
			if (!confirm('Discard unsaved changes?')) return;
		}
		onClose();
	}
	
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSave();
		}
		if (e.key === 'Escape') {
			handleCancel();
		}
	}
	
	function restoreFromHistory(text: string) {
		editText = text;
		showHistory = false;
	}
	
	// Load on mount
	$effect(() => {
		loadEdit();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="message-editor" onkeydown={handleKeyDown}>
	<div class="editor-header">
		<h3 class="editor-title">Edit Message</h3>
		<div class="editor-actions">
			{#if hasEdits}
				<button 
					class="btn btn-ghost" 
					onclick={() => showDiff = !showDiff}
					class:active={showDiff}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M16 3h5v5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M8 21H3v-5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M21 3l-9 9" stroke-linecap="round"/>
						<path d="M3 21l9-9" stroke-linecap="round"/>
					</svg>
					Diff
				</button>
				<button 
					class="btn btn-ghost"
					onclick={() => showHistory = !showHistory}
					class:active={showHistory}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<polyline points="12,6 12,12 16,14" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					History ({editRecord?.editHistory.length ?? 0})
				</button>
				<button class="btn btn-ghost btn-danger" onclick={handleRevert}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M3 3v5h5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					Revert
				</button>
			{/if}
		</div>
	</div>
	
	{#if isLoading}
		<div class="editor-loading">
			<div class="loading-spinner"></div>
			<span>Loading...</span>
		</div>
	{:else if showDiff && hasEdits}
		<DiffView 
			original={originalText} 
			current={editText} 
		/>
	{:else if showHistory && editRecord}
		<EditHistory 
			{editRecord}
			{originalText}
			onRestore={restoreFromHistory}
		/>
	{:else}
		<div class="editor-content">
			<textarea
				class="edit-textarea"
				bind:value={editText}
				placeholder="Enter message text..."
				spellcheck="true"
			></textarea>
		</div>
	{/if}
	
	<div class="editor-footer">
		<div class="footer-info">
			{#if hasChanges}
				<span class="unsaved-indicator">Unsaved changes</span>
			{:else if hasEdits}
				<span class="edited-indicator">Edited</span>
			{/if}
		</div>
		<div class="footer-actions">
			<button class="btn btn-ghost" onclick={handleCancel}>
				Cancel
			</button>
			<button 
				class="btn btn-primary" 
				onclick={handleSave}
				disabled={!hasChanges || isSaving}
			>
				{#if isSaving}
					Saving...
				{:else}
					Save
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.message-editor {
		display: flex;
		flex-direction: column;
		background-color: var(--cdv-color-bg-raised);
		border: 1px solid var(--cdv-color-border-default);
		border-radius: var(--cdv-radius-xl);
		overflow: hidden;
		max-height: 80vh;
	}
	
	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--cdv-space-3) var(--cdv-space-4);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
		background-color: var(--cdv-color-bg-elevated);
	}
	
	.editor-title {
		font-size: var(--cdv-font-size-base);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-primary);
		margin: 0;
	}
	
	.editor-actions {
		display: flex;
		gap: var(--cdv-space-2);
	}
	
	.editor-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-3);
		padding: var(--cdv-space-8);
		color: var(--cdv-color-text-secondary);
	}
	
	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--cdv-color-border-subtle);
		border-top-color: var(--cdv-color-accent-500);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	
	.editor-content {
		flex: 1;
		min-height: 200px;
		max-height: 400px;
		overflow: hidden;
	}
	
	.edit-textarea {
		width: 100%;
		height: 100%;
		min-height: 200px;
		padding: var(--cdv-space-4);
		font-family: var(--cdv-font-body);
		font-size: var(--cdv-font-size-base);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-primary);
		background-color: var(--cdv-color-bg-base);
		border: none;
		resize: vertical;
	}
	
	.edit-textarea:focus {
		outline: none;
		background-color: var(--cdv-color-surface-primary);
	}
	
	.edit-textarea::placeholder {
		color: var(--cdv-color-text-placeholder);
	}
	
	.editor-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--cdv-space-3) var(--cdv-space-4);
		border-top: 1px solid var(--cdv-color-border-subtle);
		background-color: var(--cdv-color-bg-elevated);
	}
	
	.footer-info {
		font-size: var(--cdv-font-size-sm);
	}
	
	.unsaved-indicator {
		color: var(--cdv-color-warning-500);
	}
	
	.edited-indicator {
		color: var(--cdv-color-accent-400);
	}
	
	.footer-actions {
		display: flex;
		gap: var(--cdv-space-2);
	}
	
	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--cdv-space-1-5);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		border-radius: var(--cdv-radius-md);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.btn-ghost {
		background-color: transparent;
		border: 1px solid var(--cdv-color-border-subtle);
		color: var(--cdv-color-text-secondary);
	}
	
	.btn-ghost:hover {
		background-color: var(--cdv-color-bg-hover);
		border-color: var(--cdv-color-border-default);
		color: var(--cdv-color-text-primary);
	}
	
	.btn-ghost.active {
		background-color: var(--cdv-color-accent-500);
		border-color: var(--cdv-color-accent-500);
		color: var(--cdv-color-black);
	}
	
	.btn-ghost.btn-danger:hover {
		background-color: var(--cdv-color-error-muted);
		border-color: var(--cdv-color-error-500);
		color: var(--cdv-color-error-500);
	}
	
	.btn-primary {
		background-color: var(--cdv-color-accent-500);
		border: 1px solid var(--cdv-color-accent-500);
		color: var(--cdv-color-black);
	}
	
	.btn-primary:hover:not(:disabled) {
		background-color: var(--cdv-color-accent-400);
		border-color: var(--cdv-color-accent-400);
	}
	
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
