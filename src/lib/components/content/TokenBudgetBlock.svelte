<script lang="ts">
	import type { TokenBudgetContent } from '$lib/types';
	
	interface Props {
		content: TokenBudgetContent;
	}
	
	let { content }: Props = $props();
	let isExpanded = $state(false);
	
	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
</script>

<div class="token-budget-block" class:expanded={isExpanded}>
	<button class="budget-header" onclick={toggleExpanded}>
		<div class="budget-icon">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
				<line x1="3" y1="9" x2="21" y2="9" stroke-linecap="round"/>
				<line x1="9" y1="21" x2="9" y2="9" stroke-linecap="round"/>
			</svg>
		</div>
		
		<span class="budget-label">Token Budget</span>
		
		<span class="budget-info">Context management</span>
		
		<div class="expand-icon" class:rotated={isExpanded}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="6,9 12,15 18,9" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</div>
	</button>
	
	{#if isExpanded}
		<div class="budget-content">
			<pre class="budget-json">{JSON.stringify(content, null, 2)}</pre>
		</div>
	{/if}
</div>

<style>
	.token-budget-block {
		background-color: var(--cdv-color-bg-elevated);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-md);
		overflow: hidden;
	}
	
	.budget-header {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		width: 100%;
		padding: var(--cdv-space-2) var(--cdv-space-3);
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
	}
	
	.budget-icon {
		color: var(--cdv-color-text-tertiary);
	}
	
	.budget-label {
		font-size: var(--cdv-font-size-xs);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-secondary);
	}
	
	.budget-info {
		flex: 1;
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
		text-align: right;
	}
	
	.expand-icon {
		flex-shrink: 0;
		color: var(--cdv-color-text-tertiary);
		transition: transform var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.expand-icon.rotated {
		transform: rotate(180deg);
	}
	
	.budget-content {
		padding: var(--cdv-space-3);
		border-top: 1px solid var(--cdv-color-border-subtle);
		animation: slideDown var(--cdv-transition-normal) var(--cdv-ease-out);
	}
	
	.budget-json {
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-xs);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-tertiary);
		background-color: var(--cdv-color-bg-base);
		padding: var(--cdv-space-3);
		border-radius: var(--cdv-radius-sm);
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 200px;
		overflow-y: auto;
	}
</style>
