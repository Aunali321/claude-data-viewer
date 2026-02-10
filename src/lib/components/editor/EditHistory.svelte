<script lang="ts">
	import type { EditRecord } from '$lib/types';
	
	interface Props {
		editRecord: EditRecord;
		originalText: string;
		onRestore: (text: string) => void;
	}
	
	let { editRecord, originalText, onRestore }: Props = $props();
	
	function formatTimestamp(ts: string): string {
		const date = new Date(ts);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
	
	function getPreview(text: string): string {
		const lines = text.split('\n');
		const preview = lines.slice(0, 3).join('\n');
		if (lines.length > 3) {
			return preview + '...';
		}
		return preview;
	}
	
	// Build history list with original and all edits
	let historyItems = $derived([
		{
			text: originalText,
			timestamp: editRecord.createdAt,
			label: 'Original',
			isOriginal: true
		},
		...editRecord.editHistory.map((edit, index) => ({
			text: edit.text,
			timestamp: edit.timestamp,
			label: `Edit ${index + 1}`,
			isOriginal: false
		})),
		{
			text: editRecord.currentText,
			timestamp: editRecord.updatedAt,
			label: 'Current',
			isOriginal: false,
			isCurrent: true
		}
	]);
</script>

<div class="edit-history">
	<div class="history-header">
		<span class="history-title">Edit History</span>
		<span class="history-count">{historyItems.length} versions</span>
	</div>
	
	<div class="history-list">
		{#each historyItems as item, index}
			<div class="history-item" class:original={item.isOriginal} class:current={item.isCurrent}>
				<div class="item-header">
					<span class="item-label">{item.label}</span>
					<span class="item-timestamp">{formatTimestamp(item.timestamp)}</span>
				</div>
				
				<div class="item-preview">
					{getPreview(item.text)}
				</div>
				
				{#if !item.isCurrent}
					<button 
						class="restore-btn"
						onclick={() => onRestore(item.text)}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke-linecap="round" stroke-linejoin="round"/>
							<path d="M3 3v5h5" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						Restore
					</button>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.edit-history {
		display: flex;
		flex-direction: column;
		max-height: 400px;
		overflow: hidden;
	}
	
	.history-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--cdv-space-3) var(--cdv-space-4);
		background-color: var(--cdv-color-bg-elevated);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
	}
	
	.history-title {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-secondary);
	}
	
	.history-count {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}
	
	.history-list {
		flex: 1;
		overflow-y: auto;
		padding: var(--cdv-space-2);
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-2);
	}
	
	.history-item {
		padding: var(--cdv-space-3);
		background-color: var(--cdv-color-bg-base);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-lg);
		position: relative;
	}
	
	.history-item.original {
		border-left: 3px solid var(--cdv-color-info-500);
	}
	
	.history-item.current {
		border-left: 3px solid var(--cdv-color-accent-500);
		background-color: rgba(245, 158, 11, 0.05);
	}
	
	.item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--cdv-space-2);
	}
	
	.item-label {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-primary);
	}
	
	.history-item.original .item-label {
		color: var(--cdv-color-info-500);
	}
	
	.history-item.current .item-label {
		color: var(--cdv-color-accent-400);
	}
	
	.item-timestamp {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}
	
	.item-preview {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		white-space: pre-wrap;
		word-break: break-word;
		line-height: var(--cdv-line-height-relaxed);
		max-height: 80px;
		overflow: hidden;
		margin-bottom: var(--cdv-space-2);
	}
	
	.restore-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--cdv-space-1);
		padding: var(--cdv-space-1) var(--cdv-space-2);
		font-size: var(--cdv-font-size-xs);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-secondary);
		background-color: transparent;
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-md);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.restore-btn:hover {
		background-color: var(--cdv-color-bg-hover);
		border-color: var(--cdv-color-border-default);
		color: var(--cdv-color-text-primary);
	}
</style>
