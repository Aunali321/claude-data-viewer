<script lang="ts">
	import type { ToolUseContent, ArtifactInput } from '$lib/types';
	import { marked } from 'marked';
	import hljs from 'highlight.js';
	
	interface Props {
		content: ToolUseContent;
		allArtifactVersions?: ArtifactInput[];
	}
	
	let { content, allArtifactVersions = [] }: Props = $props();
	let isExpanded = $state(false);
	let viewMode = $state<'preview' | 'code'>('preview');
	let artifactHtml = $state('');
	let showVersionDropdown = $state(false);
	let selectedVersionIndex = $state<number | null>(null);
	
	let isArtifact = $derived(content.name === 'artifacts');
	let isWebSearch = $derived(content.name === 'web_search');
	let originalArtifactInput = $derived(isArtifact ? content.input as unknown as ArtifactInput : null);
	
	// Track current version index in the versions array
	let currentVersionIndex = $derived(() => {
		if (!originalArtifactInput || allArtifactVersions.length === 0) return -1;
		return allArtifactVersions.findIndex(v => v.version_uuid === originalArtifactInput?.version_uuid);
	});
	
	// The displayed artifact - either selected version or original
	let artifactInput = $derived(() => {
		if (selectedVersionIndex !== null && allArtifactVersions[selectedVersionIndex]) {
			return allArtifactVersions[selectedVersionIndex];
		}
		return originalArtifactInput;
	});
	
	// Version number for display (1-indexed)
	let versionNumber = $derived(() => {
		if (selectedVersionIndex !== null) return selectedVersionIndex + 1;
		const idx = currentVersionIndex();
		return idx >= 0 ? idx + 1 : null;
	});
	
	// Check if there are multiple versions
	let hasMultipleVersions = $derived(allArtifactVersions.length > 1);
	
	function selectVersion(index: number) {
		selectedVersionIndex = index;
		showVersionDropdown = false;
	}
	
	// Get artifact type label
	function getArtifactTypeLabel(type: string): string {
		if (type.includes('code') || type.startsWith('application/vnd.ant.code')) {
			return 'Code';
		}
		if (type.includes('markdown') || type === 'text/markdown') {
			return 'Document';
		}
		if (type.includes('html')) {
			return 'HTML';
		}
		if (type.includes('react') || type.includes('component')) {
			return 'React';
		}
		if (type.includes('svg')) {
			return 'SVG';
		}
		return type.split('/').pop() || 'File';
	}
	
	// Get language from artifact type
	function getLanguage(type: string): string {
		const parts = type.split('/');
		const last = parts[parts.length - 1];
		if (last.startsWith('vnd.ant.code+')) {
			return last.replace('vnd.ant.code+', '');
		}
		if (type.includes('javascript') || type.includes('jsx')) return 'javascript';
		if (type.includes('typescript') || type.includes('tsx')) return 'typescript';
		if (type.includes('python')) return 'python';
		if (type.includes('markdown')) return 'markdown';
		if (type.includes('html')) return 'html';
		if (type.includes('css')) return 'css';
		if (type.includes('json')) return 'json';
		return last;
	}
	
	function renderArtifactContent(input: ArtifactInput): string {
		if (!input.content) return '';
		
		if (input.type.includes('markdown') || input.type === 'text/markdown') {
			return marked.parse(input.content) as string;
		}
		
		// For code, use highlight.js
		const lang = getLanguage(input.type);
		try {
			if (hljs.getLanguage(lang)) {
				return `<pre><code class="hljs language-${lang}">${hljs.highlight(input.content, { language: lang }).value}</code></pre>`;
			}
		} catch {}
		
		return `<pre><code>${escapeHtml(input.content)}</code></pre>`;
	}
	
	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}
	
	function getCodePreview(content: string): string {
		const lines = content.split('\n').slice(0, 8);
		return lines.join('\n');
	}
	
	$effect(() => {
		const input = artifactInput();
		if (input) {
			artifactHtml = renderArtifactContent(input);
		}
	});
</script>

{#if isArtifact && artifactInput()}
	<!-- Artifact Card - Claude-style -->
	{@const currentArtifact = artifactInput()}
	<div class="artifact-card">
		<div class="artifact-header">
			<div class="artifact-info">
				<h4 class="artifact-title">{currentArtifact?.title || 'Untitled'}</h4>
				<div class="artifact-meta">
					<span class="artifact-type">{getArtifactTypeLabel(currentArtifact?.type || '')}</span>
					{#if hasMultipleVersions}
						<!-- Version dropdown -->
						<div class="version-dropdown-wrapper">
							<button 
								class="version-dropdown-trigger" 
								onclick={() => showVersionDropdown = !showVersionDropdown}
							>
								Version {versionNumber()} of {allArtifactVersions.length}
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="6,9 12,15 18,9" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</button>
							{#if showVersionDropdown}
								<div class="version-dropdown-menu">
									{#each allArtifactVersions as version, idx}
										<button 
											class="version-option"
											class:active={versionNumber() === idx + 1}
											onclick={() => selectVersion(idx)}
										>
											<span class="version-option-number">v{idx + 1}</span>
											<span class="version-option-title">{version.title || 'Untitled'}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{:else if versionNumber()}
						<span class="artifact-version">Version {versionNumber()}</span>
					{/if}
				</div>
			</div>
			
			<div class="artifact-preview-thumb">
				{#if currentArtifact?.content}
					<pre class="preview-code">{getCodePreview(currentArtifact.content)}</pre>
				{/if}
			</div>
		</div>
		
		{#if isExpanded}
			<div class="artifact-content">
				<div class="artifact-toolbar">
					<button 
						class="toolbar-btn" 
						class:active={viewMode === 'preview'}
						onclick={() => viewMode = 'preview'}
					>
						Preview
					</button>
					<button 
						class="toolbar-btn"
						class:active={viewMode === 'code'}
						onclick={() => viewMode = 'code'}
					>
						Code
					</button>
				</div>
				
				{#if viewMode === 'preview'}
					<div class="artifact-preview prose-cdv">
						{@html artifactHtml}
					</div>
				{:else}
					<div class="artifact-code">
						<pre><code>{currentArtifact?.content}</code></pre>
					</div>
				{/if}
			</div>
		{/if}
		
		<button class="artifact-toggle" onclick={() => isExpanded = !isExpanded}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points={isExpanded ? "18,15 12,9 6,15" : "6,9 12,15 18,9"} stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			{isExpanded ? 'Collapse' : 'Expand'}
		</button>
	</div>
{:else if isWebSearch}
	<!-- Web Search -->
	<div class="web-search-block">
		<div class="search-header">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8"/>
				<line x1="21" y1="21" x2="16.65" y2="16.65" stroke-linecap="round"/>
			</svg>
			<span class="search-query">{content.input.query || 'Web search'}</span>
		</div>
	</div>
{:else}
	<!-- Generic tool use -->
	<div class="tool-block">
		<button class="tool-header" onclick={() => isExpanded = !isExpanded}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			<span class="tool-name">{content.name}</span>
			<svg class="chevron" class:rotated={isExpanded} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="6,9 12,15 18,9" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</button>
		
		{#if isExpanded}
			<div class="tool-content">
				<pre>{JSON.stringify(content.input, null, 2)}</pre>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Artifact Card - Claude-style */
	.artifact-card {
		background-color: var(--cdv-color-bg-elevated);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-xl);
		overflow: hidden;
	}
	
	.artifact-header {
		display: flex;
		align-items: stretch;
		gap: var(--cdv-space-4);
		padding: var(--cdv-space-4);
		background-color: var(--cdv-color-bg-raised);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
	}
	
	.artifact-info {
		flex: 1;
		min-width: 0;
	}
	
	.artifact-title {
		font-size: var(--cdv-font-size-base);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-primary);
		margin: 0 0 var(--cdv-space-2) 0;
		line-height: var(--cdv-line-height-snug);
	}
	
	.artifact-meta {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
	}
	
	.artifact-type {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-tool);
		background-color: var(--cdv-color-tool-bg);
		padding: var(--cdv-space-0-5) var(--cdv-space-2);
		border-radius: var(--cdv-radius-md);
		font-weight: var(--cdv-font-weight-medium);
	}
	
	.artifact-version {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}
	
	/* Version dropdown */
	.version-dropdown-wrapper {
		position: relative;
	}
	
	.version-dropdown-trigger {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-1);
		padding: var(--cdv-space-0-5) var(--cdv-space-2);
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-accent-400);
		background-color: transparent;
		border: 1px solid var(--cdv-color-accent-400);
		border-radius: var(--cdv-radius-md);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.version-dropdown-trigger:hover {
		background-color: var(--cdv-color-accent-500);
		color: var(--cdv-color-black);
		border-color: var(--cdv-color-accent-500);
	}
	
	.version-dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: var(--cdv-z-dropdown);
		min-width: 200px;
		max-height: 240px;
		overflow-y: auto;
		margin-top: var(--cdv-space-1);
		background-color: var(--cdv-color-bg-elevated);
		border: 1px solid var(--cdv-color-border-default);
		border-radius: var(--cdv-radius-lg);
		box-shadow: var(--cdv-shadow-lg);
		padding: var(--cdv-space-1);
	}
	
	.version-option {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		width: 100%;
		padding: var(--cdv-space-2) var(--cdv-space-3);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--cdv-radius-md);
		cursor: pointer;
		text-align: left;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.version-option:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}
	
	.version-option.active {
		background-color: var(--cdv-color-accent-500);
		color: var(--cdv-color-black);
	}
	
	.version-option-number {
		font-weight: var(--cdv-font-weight-semibold);
		min-width: 28px;
	}
	
	.version-option-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.artifact-preview-thumb {
		width: 120px;
		height: 80px;
		flex-shrink: 0;
		background-color: var(--cdv-color-bg-base);
		border-radius: var(--cdv-radius-lg);
		overflow: hidden;
		border: 1px solid var(--cdv-color-border-subtle);
	}
	
	.preview-code {
		font-family: var(--cdv-font-mono);
		font-size: 6px;
		line-height: 1.3;
		color: var(--cdv-color-text-tertiary);
		margin: 0;
		padding: var(--cdv-space-2);
		overflow: hidden;
		white-space: pre;
	}
	
	.artifact-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-2);
		width: 100%;
		padding: var(--cdv-space-2);
		background: transparent;
		border: none;
		border-top: 1px solid var(--cdv-color-border-subtle);
		color: var(--cdv-color-text-tertiary);
		font-size: var(--cdv-font-size-sm);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.artifact-toggle:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}
	
	.artifact-content {
		border-top: 1px solid var(--cdv-color-border-subtle);
	}
	
	.artifact-toolbar {
		display: flex;
		gap: var(--cdv-space-1);
		padding: var(--cdv-space-2) var(--cdv-space-4);
		background-color: var(--cdv-color-bg-raised);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
	}
	
	.toolbar-btn {
		padding: var(--cdv-space-1-5) var(--cdv-space-3);
		font-size: var(--cdv-font-size-xs);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-secondary);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--cdv-radius-md);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.toolbar-btn:hover {
		background-color: var(--cdv-color-bg-hover);
	}
	
	.toolbar-btn.active {
		background-color: var(--cdv-color-accent-500);
		color: var(--cdv-color-black);
	}
	
	.artifact-preview {
		padding: var(--cdv-space-4);
		max-height: 500px;
		overflow-y: auto;
	}
	
	.artifact-code {
		padding: 0;
		max-height: 500px;
		overflow: auto;
	}
	
	.artifact-code pre {
		margin: 0;
		padding: var(--cdv-space-4);
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-sm);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-primary);
		background-color: var(--cdv-color-bg-base);
	}
	
	.artifact-code code {
		font-family: inherit;
	}
	
	/* Web Search */
	.web-search-block {
		background-color: var(--cdv-color-bg-elevated);
		border-radius: var(--cdv-radius-xl);
		padding: var(--cdv-space-3) var(--cdv-space-4);
	}
	
	.search-header {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		color: var(--cdv-color-text-secondary);
	}
	
	.search-query {
		font-size: var(--cdv-font-size-sm);
	}
	
	/* Generic tool */
	.tool-block {
		background-color: var(--cdv-color-bg-elevated);
		border-radius: var(--cdv-radius-xl);
		overflow: hidden;
	}
	
	.tool-header {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		width: 100%;
		padding: var(--cdv-space-3) var(--cdv-space-4);
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--cdv-color-text-secondary);
		transition: color var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.tool-header:hover {
		color: var(--cdv-color-text-primary);
	}
	
	.tool-name {
		flex: 1;
		text-align: left;
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
	}
	
	.chevron {
		transition: transform var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.chevron.rotated {
		transform: rotate(180deg);
	}
	
	.tool-content {
		padding: 0 var(--cdv-space-4) var(--cdv-space-4);
	}
	
	.tool-content pre {
		margin: 0;
		padding: var(--cdv-space-3);
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		background-color: var(--cdv-color-bg-base);
		border-radius: var(--cdv-radius-lg);
		overflow-x: auto;
	}
</style>
