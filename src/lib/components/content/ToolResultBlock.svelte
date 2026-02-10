<script lang="ts">
	import type { ToolResultContent, StoredImage } from '$lib/types';
	import { getImage } from '$lib/db';
	
	interface Props {
		content: ToolResultContent;
	}
	
	let { content }: Props = $props();
	let isExpanded = $state(false);
	let loadedImages = $state<Map<string, StoredImage>>(new Map());
	
	let isWebSearchResult = $derived(content.name === 'web_search');
	let hasKnowledgeResults = $derived(
		content.content?.some(item => item.type === 'knowledge')
	);
	let hasImageResults = $derived(
		content.content?.some(item => item.type === 'image' && item.file_uuid)
	);
	let imageItems = $derived(
		content.content?.filter(item => item.type === 'image' && item.file_uuid) || []
	);
	
	$effect(() => {
		if (hasImageResults) {
			loadImages();
		}
	});
	
	async function loadImages() {
		const newMap = new Map<string, StoredImage>();
		for (const item of imageItems) {
			if (item.file_uuid) {
				const img = await getImage(item.file_uuid);
				if (img) {
					newMap.set(item.file_uuid, img);
				}
			}
		}
		loadedImages = newMap;
	}
	
	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
</script>

<div class="tool-result-block" class:error={content.is_error} class:expanded={isExpanded}>
	{#if hasImageResults}
		<!-- Image results -->
		<div class="image-results">
			{#each imageItems as item}
				{@const image = item.file_uuid ? loadedImages.get(item.file_uuid) : null}
				{#if image}
					<div class="image-item">
						<img 
							src="data:{image.mimeType};base64,{image.data}" 
							alt="Fetched from Claude"
							class="result-image"
						/>
					</div>
				{:else}
					<div class="image-placeholder">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
							<circle cx="8.5" cy="8.5" r="1.5"/>
							<polyline points="21,15 16,10 5,21"/>
						</svg>
						<span>Image not fetched</span>
						<span class="image-uuid">{item.file_uuid?.slice(0, 8)}...</span>
					</div>
				{/if}
			{/each}
		</div>
	{:else if isWebSearchResult && hasKnowledgeResults}
		<!-- Web search results as styled cards -->
		<div class="search-results">
			{#each content.content as item}
				{#if item.type === 'knowledge' && item.url}
					<a href={item.url} target="_blank" rel="noopener noreferrer" class="search-result-card">
						<div class="result-header">
							{#if item.metadata?.favicon_url}
								<img src={item.metadata.favicon_url} alt="" class="result-favicon" />
							{/if}
							<span class="result-site">{item.metadata?.site_name || item.metadata?.site_domain || 'Source'}</span>
							{#if item.is_citable}
								<span class="cited-badge">Cited</span>
							{/if}
						</div>
						<h4 class="result-title">{item.title}</h4>
						{#if item.text}
							<p class="result-snippet">{item.text.slice(0, 200)}{item.text.length > 200 ? '...' : ''}</p>
						{/if}
					</a>
				{/if}
			{/each}
		</div>
	{:else}
		<!-- Generic tool result -->
		<button class="result-header-btn" onclick={toggleExpanded}>
			<div class="result-icon" class:error={content.is_error}>
				{#if content.is_error}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<line x1="15" y1="9" x2="9" y2="15" stroke-linecap="round"/>
						<line x1="9" y1="9" x2="15" y2="15" stroke-linecap="round"/>
					</svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="20,6 9,17 4,12" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				{/if}
			</div>
			
			<span class="result-label">
				{content.is_error ? 'Error' : 'Result'}: {content.name}
			</span>
			
			<div class="expand-icon" class:rotated={isExpanded}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="6,9 12,15 18,9" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</div>
		</button>
		
		{#if isExpanded}
			<div class="result-content">
				<pre class="result-json">{JSON.stringify(content.content, null, 2)}</pre>
			</div>
		{/if}
	{/if}
</div>

<style>
	.tool-result-block {
		border-radius: var(--cdv-radius-lg);
		overflow: hidden;
	}
	
	.tool-result-block.error {
		background-color: var(--cdv-color-error-muted);
	}
	
	.image-results {
		display: flex;
		flex-wrap: wrap;
		gap: var(--cdv-space-3);
	}
	
	.image-item {
		border-radius: var(--cdv-radius-lg);
		overflow: hidden;
		border: 1px solid var(--cdv-color-border-subtle);
	}
	
	.result-image {
		max-width: 100%;
		max-height: 400px;
		display: block;
	}
	
	.image-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-6);
		background-color: var(--cdv-color-bg-elevated);
		border: 1px dashed var(--cdv-color-border-default);
		border-radius: var(--cdv-radius-lg);
		color: var(--cdv-color-text-tertiary);
		min-width: 200px;
	}
	
	.image-placeholder span {
		font-size: var(--cdv-font-size-sm);
	}
	
	.image-uuid {
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-xs);
		opacity: 0.7;
	}
	
	.search-results {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-2);
	}
	
	.search-result-card {
		display: block;
		padding: var(--cdv-space-3);
		background-color: var(--cdv-color-surface-secondary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-md);
		text-decoration: none;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.search-result-card:hover {
		background-color: var(--cdv-color-surface-tertiary);
		border-color: var(--cdv-color-border-default);
	}
	
	.result-header {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		margin-bottom: var(--cdv-space-2);
	}
	
	.result-favicon {
		width: 16px;
		height: 16px;
		border-radius: var(--cdv-radius-sm);
	}
	
	.result-site {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}
	
	.cited-badge {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-success-500);
		background-color: var(--cdv-color-success-muted);
		padding: var(--cdv-space-0-5) var(--cdv-space-1-5);
		border-radius: var(--cdv-radius-sm);
		margin-left: auto;
	}
	
	.result-title {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-accent-400);
		margin: 0 0 var(--cdv-space-1) 0;
	}
	
	.result-snippet {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		margin: 0;
		line-height: var(--cdv-line-height-normal);
	}
	
	.result-header-btn {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		width: 100%;
		padding: var(--cdv-space-3) var(--cdv-space-4);
		background-color: var(--cdv-color-bg-elevated);
		border: none;
		cursor: pointer;
		text-align: left;
	}
	
	.result-icon {
		color: var(--cdv-color-success-500);
	}
	
	.result-icon.error {
		color: var(--cdv-color-error-500);
	}
	
	.result-label {
		flex: 1;
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
	}
	
	.expand-icon {
		flex-shrink: 0;
		color: var(--cdv-color-text-tertiary);
		transition: transform var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.expand-icon.rotated {
		transform: rotate(180deg);
	}
	
	.result-content {
		padding: var(--cdv-space-4);
		animation: slideDown var(--cdv-transition-normal) var(--cdv-ease-out);
	}
	
	.result-json {
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-sm);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-secondary);
		background-color: var(--cdv-color-bg-base);
		padding: var(--cdv-space-4);
		border-radius: var(--cdv-radius-md);
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 300px;
		overflow-y: auto;
	}
</style>
