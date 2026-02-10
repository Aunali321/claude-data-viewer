<script lang="ts">
	import type { TextContent, Citation } from '$lib/types';
	import { marked } from 'marked';
	import hljs from 'highlight.js';
	
	interface Props {
		content: TextContent;
		editedText?: string | null;
	}
	
	let { content, editedText = null }: Props = $props();
	let renderedHtml = $state('');
	let containerRef: HTMLDivElement;
	let hoveredCitation = $state<Citation | null>(null);
	let hoverPosition = $state({ x: 0, y: 0 });
	
	// The text to display - use edited text if available
	let displayText = $derived(editedText ?? content.text);
	let isEdited = $derived(editedText !== null && editedText !== content.text);
	let hasCitations = $derived(content.citations && content.citations.length > 0);
	
	// Configure marked for GFM
	marked.setOptions({
		gfm: true,
		breaks: true
	});
	
	function renderMarkdown(text: string): string {
		try {
			let html = marked.parse(text) as string;
			
			// If there are citations, add footnote markers
			if (hasCitations && content.citations) {
				content.citations.forEach((citation, index) => {
					// Look for citation patterns like [1], [2], etc. and make them interactive
					const marker = `[${index + 1}]`;
					const escapedMarker = marker.replace(/[[\]]/g, '\\$&');
					const regex = new RegExp(escapedMarker, 'g');
					html = html.replace(regex, `<sup class="citation-marker" data-citation-index="${index}">${marker}</sup>`);
				});
			}
			
			return html;
		} catch {
			return text;
		}
	}
	
	function highlightCodeBlocks() {
		if (!containerRef) return;
		
		const codeBlocks = containerRef.querySelectorAll('pre code');
		codeBlocks.forEach((block) => {
			if (!block.classList.contains('hljs')) {
				hljs.highlightElement(block as HTMLElement);
			}
		});
		
		// Add citation hover listeners
		if (hasCitations) {
			const markers = containerRef.querySelectorAll('.citation-marker');
			markers.forEach((marker) => {
				marker.addEventListener('mouseenter', handleCitationHover);
				marker.addEventListener('mouseleave', handleCitationLeave);
			});
		}
	}
	
	function handleCitationHover(e: Event) {
		const target = e.target as HTMLElement;
		const index = parseInt(target.dataset.citationIndex || '0', 10);
		if (content.citations && content.citations[index]) {
			hoveredCitation = content.citations[index];
			const rect = target.getBoundingClientRect();
			hoverPosition = { x: rect.left, y: rect.bottom + 8 };
		}
	}
	
	function handleCitationLeave() {
		hoveredCitation = null;
	}
	
	function getCitationText(citation: Citation): string {
		// Extract useful info from citation object
		if (typeof citation === 'object' && citation !== null) {
			const c = citation as Record<string, unknown>;
			if (c.title) return String(c.title);
			if (c.text) return String(c.text);
			if (c.url) return String(c.url);
			return JSON.stringify(citation);
		}
		return String(citation);
	}
	
	$effect(() => {
		renderedHtml = renderMarkdown(displayText);
	});
	
	$effect(() => {
		if (renderedHtml) {
			queueMicrotask(highlightCodeBlocks);
		}
	});
</script>

<div class="text-block prose-cdv" class:edited={isEdited} bind:this={containerRef}>
	{#if isEdited}
		<span class="edited-indicator" title="This content has been edited">edited</span>
	{/if}
	{@html renderedHtml}
	
	{#if hasCitations && content.citations && content.citations.length > 0}
		<div class="citations-footer">
			<div class="citations-title">Sources</div>
			{#each content.citations as citation, index}
				<div class="citation-item">
					<span class="citation-number">[{index + 1}]</span>
					<span class="citation-text">{getCitationText(citation)}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if hoveredCitation}
	<div 
		class="citation-tooltip" 
		style="left: {hoverPosition.x}px; top: {hoverPosition.y}px;"
	>
		{getCitationText(hoveredCitation)}
	</div>
{/if}

<style>
	.text-block {
		font-size: 1rem;
		line-height: 1.7;
		color: var(--cdv-color-text-primary);
		position: relative;
	}

	/* Headings - Claude style */
	.text-block :global(h1),
	.text-block :global(h2),
	.text-block :global(h3),
	.text-block :global(h4),
	.text-block :global(h5),
	.text-block :global(h6) {
		margin-top: 1.25rem;
		margin-bottom: 0.25rem;
		font-weight: var(--cdv-font-weight-bold);
		color: var(--cdv-color-text-primary);
		line-height: 1.3;
	}

	.text-block :global(h1) { font-size: 1.5rem; }
	.text-block :global(h2) { font-size: 1.125rem; }
	.text-block :global(h3) { font-size: 1rem; }

	/* Paragraphs */
	.text-block :global(p) {
		margin: 0 0 0.75rem 0;
		word-break: break-word;
	}

	.text-block :global(p:last-child) {
		margin-bottom: 0;
	}

	/* Lists */
	.text-block :global(ul),
	.text-block :global(ol) {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.75rem 0;
		padding-left: 2rem;
	}

	.text-block :global(li) {
		padding-left: 0.5rem;
		word-break: break-word;
	}

	.text-block :global(li::marker) {
		color: var(--cdv-color-text-tertiary);
	}

	/* Strong text */
	.text-block :global(strong) {
		font-weight: var(--cdv-font-weight-semibold);
	}

	/* Inline code - Claude style */
	.text-block :global(code:not(pre code)) {
		font-family: var(--cdv-font-mono);
		font-size: 0.9em;
		background-color: rgba(0, 0, 0, 0.05);
		border: 0.5px solid var(--cdv-color-border-default);
		color: var(--cdv-color-error-600);
		padding: 1px 4px;
		border-radius: 0.4rem;
		white-space: pre-wrap;
	}

	:global(.dark) .text-block :global(code:not(pre code)) {
		background-color: rgba(255, 255, 255, 0.05);
		color: var(--cdv-color-error-400);
	}

	/* Code blocks */
	.text-block :global(pre) {
		margin: 0.75rem 0;
		padding: 1rem;
		background-color: rgba(0, 0, 0, 0.03);
		border: 0.5px solid var(--cdv-color-border-default);
		border-radius: var(--cdv-radius-lg);
		overflow-x: auto;
	}

	:global(.dark) .text-block :global(pre) {
		background-color: rgba(0, 0, 0, 0.5);
	}

	.text-block :global(pre code) {
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-sm);
		line-height: 1.5;
		background: transparent;
		border: none;
		padding: 0;
		color: var(--cdv-color-text-primary);
	}

	/* Blockquotes */
	.text-block :global(blockquote) {
		margin: 0.75rem 0;
		padding-left: 1rem;
		border-left: 3px solid var(--cdv-color-brand-300);
		color: var(--cdv-color-text-secondary);
	}

	/* Links */
	.text-block :global(a) {
		color: var(--cdv-color-text-link);
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-thickness: 1px;
	}

	.text-block :global(a:hover) {
		opacity: 0.8;
	}

	/* Tables */
	.text-block :global(table) {
		width: 100%;
		margin: 0.75rem 0;
		border-collapse: collapse;
		font-size: var(--cdv-font-size-sm);
	}

	.text-block :global(th),
	.text-block :global(td) {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--cdv-color-border-default);
		text-align: left;
	}

	.text-block :global(th) {
		background-color: var(--cdv-color-bg-muted);
		font-weight: var(--cdv-font-weight-semibold);
	}

	/* Horizontal rule */
	.text-block :global(hr) {
		margin: 1.5rem 0;
		border: none;
		border-top: 1px solid var(--cdv-color-border-subtle);
	}
	
	/* Citation markers */
	.text-block :global(.citation-marker) {
		color: var(--cdv-color-brand-500);
		cursor: help;
		font-weight: var(--cdv-font-weight-medium);
	}

	.text-block :global(.citation-marker:hover) {
		color: var(--cdv-color-brand-600);
		text-decoration: underline;
	}
	
	/* Citations footer */
	.citations-footer {
		margin-top: var(--cdv-space-4);
		padding-top: var(--cdv-space-3);
		border-top: 1px solid var(--cdv-color-border-subtle);
	}
	
	.citations-title {
		font-size: var(--cdv-font-size-xs);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--cdv-space-2);
	}
	
	.citation-item {
		display: flex;
		gap: var(--cdv-space-2);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		margin-bottom: var(--cdv-space-1);
	}
	
	.citation-number {
		color: var(--cdv-color-brand-500);
		font-weight: var(--cdv-font-weight-medium);
		flex-shrink: 0;
	}
	
	.citation-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	/* Citation tooltip */
	.citation-tooltip {
		position: fixed;
		max-width: 300px;
		padding: var(--cdv-space-2) var(--cdv-space-3);
		background-color: var(--cdv-color-bg-raised);
		border: 1px solid var(--cdv-color-border-default);
		border-radius: var(--cdv-radius-lg);
		box-shadow: var(--cdv-shadow-lg);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-primary);
		z-index: var(--cdv-z-tooltip);
		pointer-events: none;
		animation: fadeIn var(--cdv-transition-fast) var(--cdv-ease-out);
	}
	
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}
	
	.text-block.edited {
		position: relative;
	}
	
	.edited-indicator {
		position: absolute;
		top: 0;
		right: 0;
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-brand-500);
		background-color: var(--cdv-color-brand-50);
		padding: var(--cdv-space-0-5) var(--cdv-space-2);
		border-radius: var(--cdv-radius-sm);
		font-style: italic;
	}
</style>
