<script lang="ts">
	import { selectedMessages, selectedByConversation, selectedCount, clearSelection } from '$lib/stores/selection';
	import { generateExport, generatePreview, downloadAsJson, defaultExportConfig } from '$lib/utils/export';
	import type { ExportFormat, MultiTurnMode, ExportConfig } from '$lib/utils/export';
	import hljs from 'highlight.js/lib/core';
	import json from 'highlight.js/lib/languages/json';
	
	hljs.registerLanguage('json', json);
	
	interface Props {
		onClose: () => void;
	}
	
	let { onClose }: Props = $props();
	
	let format = $state<ExportFormat>('openai');
	let multiTurnMode = $state<MultiTurnMode>('single');
	let includeUuid = $state(false);
	let includeTimestamps = $state(false);
	let includeThinking = $state(false);
	let includeToolCalls = $state(false);
	
	let previewJson = $state('');
	let isGenerating = $state(false);
	let totalMessages = $state(0);
	let conversationCount = $state(0);
	
	let config = $derived<ExportConfig>({
		format,
		multiTurnMode,
		includeFields: {
			uuid: includeUuid,
			timestamps: includeTimestamps,
			thinking: includeThinking,
			toolCalls: includeToolCalls
		}
	});
	
	function getMessagesByConversation() {
		const grouped = $selectedByConversation;
		const map = new Map<string, import('$lib/types').StoredMessage[]>();
		for (const [convId, data] of grouped) {
			map.set(convId, data.messages);
		}
		return map;
	}
	
	async function updatePreview() {
		const msgMap = getMessagesByConversation();
		if (msgMap.size === 0) {
			previewJson = '[]';
			return;
		}
		
		try {
			const preview = await generatePreview(msgMap, config, 4);
			previewJson = preview;
		} catch (e) {
			previewJson = `// Error generating preview: ${e}`;
		}
	}
	
	async function handleExport() {
		isGenerating = true;
		try {
			const msgMap = getMessagesByConversation();
			const data = await generateExport(msgMap, config);
			downloadAsJson(data);
			clearSelection();
			onClose();
		} catch (e) {
			console.error('Export failed:', e);
		} finally {
			isGenerating = false;
		}
	}
	
	function highlightJson(code: string): string {
		try {
			return hljs.highlight(code, { language: 'json' }).value;
		} catch {
			return code;
		}
	}
	
	$effect(() => {
		totalMessages = $selectedCount;
		conversationCount = $selectedByConversation.size;
	});
	
	$effect(() => {
		config;
		updatePreview();
	});
	
	$effect(() => {
		updatePreview();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={onClose}>
	<div class="modal-container" onclick={(e) => e.stopPropagation()}>
		<header class="modal-header">
			<h2>Export Configuration</h2>
			<button class="close-btn" onclick={onClose} aria-label="Close">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round"/>
					<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/>
				</svg>
			</button>
		</header>
		
		<div class="modal-body">
			<div class="selection-summary">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
					<polyline points="14,2 14,8 20,8" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>
					<strong>{totalMessages}</strong> message{totalMessages !== 1 ? 's' : ''} from 
					<strong>{conversationCount}</strong> conversation{conversationCount !== 1 ? 's' : ''}
				</span>
			</div>
			
			<div class="config-grid">
				<section class="config-section">
					<h3>Format</h3>
					<div class="radio-group">
						<label class="radio-option">
							<input type="radio" name="format" value="openai" bind:group={format} />
							<div class="radio-content">
								<span class="radio-label">OpenAI Chat</span>
								<span class="radio-desc">{`[{role, content}]`}</span>
							</div>
						</label>
						<label class="radio-option">
							<input type="radio" name="format" value="anthropic" bind:group={format} />
							<div class="radio-content">
								<span class="radio-label">Anthropic Messages</span>
								<span class="radio-desc">{`[{role, content: [{type, text}]}]`}</span>
							</div>
						</label>
						<label class="radio-option">
							<input type="radio" name="format" value="full" bind:group={format} />
							<div class="radio-content">
								<span class="radio-label">Full Metadata</span>
								<span class="radio-desc">UUIDs, timestamps, all fields</span>
							</div>
						</label>
						<label class="radio-option">
							<input type="radio" name="format" value="custom" bind:group={format} />
							<div class="radio-content">
								<span class="radio-label">Custom</span>
								<span class="radio-desc">Choose fields to include</span>
							</div>
						</label>
					</div>
				</section>
				
				<section class="config-section">
					<h3>Multi-turn Mode</h3>
					<div class="radio-group">
						<label class="radio-option">
							<input type="radio" name="mode" value="single" bind:group={multiTurnMode} />
							<div class="radio-content">
								<span class="radio-label">Single Conversation</span>
								<span class="radio-desc">All messages in one array</span>
							</div>
						</label>
						<label class="radio-option">
							<input type="radio" name="mode" value="multiple" bind:group={multiTurnMode} />
							<div class="radio-content">
								<span class="radio-label">Multiple Snippets</span>
								<span class="radio-desc">Each conversation as separate array</span>
							</div>
						</label>
						<label class="radio-option">
							<input type="radio" name="mode" value="system-turns" bind:group={multiTurnMode} />
							<div class="radio-content">
								<span class="radio-label">System + Turns</span>
								<span class="radio-desc">First message as system prompt</span>
							</div>
						</label>
						<label class="radio-option">
							<input type="radio" name="mode" value="split" bind:group={multiTurnMode} />
							<div class="radio-content">
								<span class="radio-label">Split Pairs</span>
								<span class="radio-desc">Each Q&A as {`{input, output}`}</span>
							</div>
						</label>
					</div>
				</section>
			</div>
			
			{#if format === 'custom'}
				<section class="config-section fields-section">
					<h3>Include Fields</h3>
					<div class="checkbox-grid">
						<label class="checkbox-option">
							<input type="checkbox" bind:checked={includeUuid} />
							<span>UUID</span>
						</label>
						<label class="checkbox-option">
							<input type="checkbox" bind:checked={includeTimestamps} />
							<span>Timestamps</span>
						</label>
						<label class="checkbox-option">
							<input type="checkbox" bind:checked={includeThinking} />
							<span>Thinking</span>
						</label>
						<label class="checkbox-option">
							<input type="checkbox" bind:checked={includeToolCalls} />
							<span>Tool Calls</span>
						</label>
					</div>
				</section>
			{/if}
			
			<section class="preview-section">
				<h3>Preview</h3>
				<div class="preview-container">
					<pre class="preview-code"><code>{@html highlightJson(previewJson)}</code></pre>
					{#if totalMessages > 4}
						<div class="preview-more">... ({totalMessages - 4} more messages)</div>
					{/if}
				</div>
			</section>
		</div>
		
		<footer class="modal-footer">
			<button class="btn-secondary" onclick={onClose}>Cancel</button>
			<button class="btn-primary" onclick={handleExport} disabled={isGenerating || totalMessages === 0}>
				{#if isGenerating}
					<span class="spinner"></span>
					Generating...
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round"/>
						<polyline points="7,10 12,15 17,10" stroke-linecap="round" stroke-linejoin="round"/>
						<line x1="12" y1="15" x2="12" y2="3" stroke-linecap="round"/>
					</svg>
					Download JSON
				{/if}
			</button>
		</footer>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--cdv-z-modal);
		padding: var(--cdv-space-4);
	}
	
	.modal-container {
		width: 100%;
		max-width: 700px;
		max-height: 90vh;
		background-color: var(--cdv-color-bg-elevated);
		border-radius: var(--cdv-radius-2xl);
		border: 1px solid var(--cdv-color-border-subtle);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: modalIn 0.2s var(--cdv-ease-out);
	}
	
	@keyframes modalIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
	
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--cdv-space-4) var(--cdv-space-5);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
	}
	
	.modal-header h2 {
		font-size: var(--cdv-font-size-lg);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-primary);
		margin: 0;
	}
	
	.close-btn {
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
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.close-btn:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}
	
	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: var(--cdv-space-5);
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-5);
	}
	
	.selection-summary {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-3) var(--cdv-space-4);
		background-color: var(--cdv-color-bg-raised);
		border-radius: var(--cdv-radius-lg);
		color: var(--cdv-color-text-secondary);
		font-size: var(--cdv-font-size-sm);
	}
	
	.selection-summary strong {
		color: var(--cdv-color-accent-400);
	}
	
	.config-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--cdv-space-5);
	}
	
	.config-section h3 {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 var(--cdv-space-3) 0;
	}
	
	.radio-group {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-2);
	}
	
	.radio-option {
		display: flex;
		align-items: flex-start;
		gap: var(--cdv-space-3);
		padding: var(--cdv-space-2-5) var(--cdv-space-3);
		background-color: var(--cdv-color-bg-base);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.radio-option:hover {
		border-color: var(--cdv-color-border-default);
		background-color: var(--cdv-color-bg-hover);
	}
	
	.radio-option:has(input:checked) {
		border-color: var(--cdv-color-accent-500);
		background-color: rgba(245, 158, 11, 0.1);
	}
	
	.radio-option input {
		margin-top: 2px;
		accent-color: var(--cdv-color-accent-500);
	}
	
	.radio-content {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-0-5);
	}
	
	.radio-label {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
	}
	
	.radio-desc {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
		font-family: var(--cdv-font-mono);
	}
	
	.fields-section {
		padding-top: var(--cdv-space-4);
		border-top: 1px solid var(--cdv-color-border-subtle);
	}
	
	.checkbox-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--cdv-space-2);
	}
	
	.checkbox-option {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		background-color: var(--cdv-color-bg-base);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-md);
		cursor: pointer;
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.checkbox-option:hover {
		border-color: var(--cdv-color-border-default);
	}
	
	.checkbox-option:has(input:checked) {
		border-color: var(--cdv-color-accent-500);
		color: var(--cdv-color-text-primary);
	}
	
	.checkbox-option input {
		accent-color: var(--cdv-color-accent-500);
	}
	
	.preview-section h3 {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 var(--cdv-space-3) 0;
	}
	
	.preview-container {
		background-color: var(--cdv-color-bg-base);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-lg);
		overflow: hidden;
	}
	
	.preview-code {
		margin: 0;
		padding: var(--cdv-space-4);
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-xs);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-secondary);
		max-height: 200px;
		overflow: auto;
		white-space: pre;
	}
	
	.preview-code code {
		font-family: inherit;
	}
	
	.preview-more {
		padding: var(--cdv-space-2) var(--cdv-space-4);
		background-color: var(--cdv-color-bg-raised);
		border-top: 1px solid var(--cdv-color-border-subtle);
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
		text-align: center;
	}
	
	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--cdv-space-3);
		padding: var(--cdv-space-4) var(--cdv-space-5);
		border-top: 1px solid var(--cdv-color-border-subtle);
		background-color: var(--cdv-color-bg-raised);
	}
	
	.btn-secondary {
		padding: var(--cdv-space-2) var(--cdv-space-4);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-secondary);
		background: transparent;
		border: 1px solid var(--cdv-color-border-default);
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.btn-secondary:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}
	
	.btn-primary {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2) var(--cdv-space-5);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-black);
		background-color: var(--cdv-color-accent-500);
		border: none;
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.btn-primary:hover:not(:disabled) {
		background-color: var(--cdv-color-accent-400);
	}
	
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid transparent;
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	
	@media (max-width: 640px) {
		.modal-container {
			max-height: 100vh;
			border-radius: 0;
		}
		
		.config-grid {
			grid-template-columns: 1fr;
		}
		
		.checkbox-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
