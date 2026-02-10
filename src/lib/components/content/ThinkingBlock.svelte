<script lang="ts">
	import type { ThinkingContent } from '$lib/types';
	
	interface Props {
		content: ThinkingContent;
	}
	
	let { content }: Props = $props();
	let isExpanded = $state(false);
	
	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
	
	// Get summary text - use first summary or generate one
	let summaryText = $derived(
		content.summaries?.[0]?.summary || 
		content.thinking.slice(0, 100).trim() + '...'
	);
	
	// Count "steps" - paragraphs or major sections in thinking
	let stepCount = $derived(() => {
		const paragraphs = content.thinking.split(/\n\n+/).filter(p => p.trim().length > 0);
		return Math.max(1, paragraphs.length);
	});
</script>

<div class="thinking-block" class:expanded={isExpanded}>
	<button class="thinking-header" onclick={toggleExpanded}>
		<div class="thinking-icon" class:expanded={isExpanded}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="6,9 12,15 18,9" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</div>
		
		<span class="thinking-summary">{summaryText}</span>
		
		{#if content.cut_off}
			<span class="truncated-badge" title="Thinking was truncated">truncated</span>
		{/if}
	</button>
	
	{#if isExpanded}
		<div class="thinking-content">
			<div class="steps-header">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<path d="M12 6v6l4 2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>{stepCount()} steps</span>
			</div>
			
			{#if content.summaries && content.summaries.length > 0}
				<div class="summaries-list">
					{#each content.summaries as summary, i}
						<div class="summary-item">
							<span class="summary-bullet"></span>
							<span class="summary-text">{summary.summary}</span>
						</div>
					{/each}
				</div>
			{/if}
			
			<details class="full-thinking">
				<summary class="full-thinking-toggle">View full thinking</summary>
				<div class="full-thinking-text">
					{content.thinking}
				</div>
			</details>
		</div>
	{/if}
</div>

<style>
	.thinking-block {
		background-color: var(--cdv-color-bg-elevated);
		border-radius: var(--cdv-radius-xl);
		overflow: hidden;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.thinking-header {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		width: 100%;
		padding: var(--cdv-space-3) var(--cdv-space-4);
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		color: var(--cdv-color-text-secondary);
		transition: color var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.thinking-header:hover {
		color: var(--cdv-color-text-primary);
	}
	
	.thinking-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform var(--cdv-transition-fast) var(--cdv-ease-default);
		transform: rotate(-90deg);
	}
	
	.thinking-icon.expanded {
		transform: rotate(0deg);
	}
	
	.thinking-summary {
		flex: 1;
		font-size: var(--cdv-font-size-sm);
		line-height: var(--cdv-line-height-snug);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.truncated-badge {
		flex-shrink: 0;
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-warning-500);
		background-color: var(--cdv-color-warning-muted);
		padding: var(--cdv-space-0-5) var(--cdv-space-2);
		border-radius: var(--cdv-radius-full);
	}
	
	.thinking-content {
		padding: 0 var(--cdv-space-4) var(--cdv-space-4);
		animation: slideDown var(--cdv-transition-normal) var(--cdv-ease-out);
	}
	
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	.steps-header {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
		margin-bottom: var(--cdv-space-3);
		padding-bottom: var(--cdv-space-3);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
	}
	
	.summaries-list {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-2);
		margin-bottom: var(--cdv-space-4);
	}
	
	.summary-item {
		display: flex;
		align-items: flex-start;
		gap: var(--cdv-space-3);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		background-color: var(--cdv-color-bg-base);
		border-radius: var(--cdv-radius-lg);
	}
	
	.summary-bullet {
		width: 6px;
		height: 6px;
		background-color: var(--cdv-color-thinking);
		border-radius: 50%;
		margin-top: 6px;
		flex-shrink: 0;
	}
	
	.summary-text {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		line-height: var(--cdv-line-height-relaxed);
	}
	
	.full-thinking {
		border-top: 1px solid var(--cdv-color-border-subtle);
		padding-top: var(--cdv-space-3);
	}
	
	.full-thinking-toggle {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
		cursor: pointer;
		user-select: none;
		list-style: none;
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
	}
	
	.full-thinking-toggle::-webkit-details-marker {
		display: none;
	}
	
	.full-thinking-toggle::before {
		content: '';
		width: 0;
		height: 0;
		border-left: 5px solid currentColor;
		border-top: 4px solid transparent;
		border-bottom: 4px solid transparent;
		transition: transform var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.full-thinking[open] .full-thinking-toggle::before {
		transform: rotate(90deg);
	}
	
	.full-thinking-toggle:hover {
		color: var(--cdv-color-text-secondary);
	}
	
	.full-thinking-text {
		margin-top: var(--cdv-space-3);
		font-size: var(--cdv-font-size-sm);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-secondary);
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 400px;
		overflow-y: auto;
		padding: var(--cdv-space-3);
		background-color: var(--cdv-color-bg-base);
		border-radius: var(--cdv-radius-lg);
	}
</style>
