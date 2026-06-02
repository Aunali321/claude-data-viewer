<script lang="ts">
	import type { StoredMessage, ContentBlock, EditRecord, ArtifactInput, ToolUseContent } from '$lib/types';
	import { getEditForMessage } from '$lib/db';
	import TextBlock from '$lib/components/content/TextBlock.svelte';
	import ThinkingBlock from '$lib/components/content/ThinkingBlock.svelte';
	import ToolUseBlock from '$lib/components/content/ToolUseBlock.svelte';
	import ToolResultBlock from '$lib/components/content/ToolResultBlock.svelte';
	import TokenBudgetBlock from '$lib/components/content/TokenBudgetBlock.svelte';
	import AttachmentCard from '$lib/components/content/AttachmentCard.svelte';
	import MessageEditor from '$lib/components/editor/MessageEditor.svelte';
	
	interface Props {
		message: StoredMessage;
		isSelected: boolean;
		onToggleSelect: (shiftKey: boolean) => void;
		artifactVersionsMap?: Map<string, ArtifactInput[]>;
	}
	
	let { message, isSelected, onToggleSelect, artifactVersionsMap }: Props = $props();
	
	let isEditing = $state(false);
	let editRecord = $state<EditRecord | null>(null);
	let showActions = $state(false);
	
	function getArtifactVersions(block: ToolUseContent): ArtifactInput[] {
		if (!artifactVersionsMap || block.name !== 'artifacts') return [];
		const input = block.input as unknown as ArtifactInput;
		if (!input?.id) return [];
		return artifactVersionsMap.get(input.id) || [];
	}
	
	async function checkForEdits() {
		const existing = await getEditForMessage(message.uuid);
		editRecord = existing ?? null;
	}
	
	function openEditor() {
		isEditing = true;
	}
	
	function closeEditor() {
		isEditing = false;
	}
	
	function handleSave() {
		checkForEdits();
	}
	
	function handleCheckboxClick(e: MouseEvent) {
		e.stopPropagation();
		onToggleSelect(e.shiftKey);
	}
	
	$effect(() => {
		checkForEdits();
	});
	
	let isHuman = $derived(message.sender === 'human');
	let isAssistant = $derived(message.sender === 'assistant');
	
	let hasFlags = $derived(message.content.some(b => b.flags !== null && b.flags !== undefined));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="message-row"
	class:selected={isSelected}
	onmouseenter={() => showActions = true}
	onmouseleave={() => showActions = false}
>
	<!-- Message content -->
	{#if isHuman}
		<div class="message human-message">
			<div class="message-actions" class:visible={showActions || isSelected}>
				<button class="action-btn" onclick={openEditor} title="Edit">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			</div>

			<div class="human-bubble">
				{#if message.attachments.length > 0}
					<div class="attachments-row">
						{#each message.attachments as attachment}
							<AttachmentCard {attachment} exportId={message.exportId} compact={true} />
						{/each}
					</div>
				{/if}

				{#each message.content as block}
					{#if block.type === 'text'}
						<div class="human-text">{block.text}</div>
					{/if}
				{/each}

				{#if editRecord}
					<span class="edited-badge">edited</span>
				{/if}
			</div>
		</div>
	{:else}
		<div class="message assistant-message">
			<div class="message-actions" class:visible={showActions || isSelected}>
				<button class="action-btn" onclick={openEditor} title="Edit">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
				{#if hasFlags}
					<span class="flags-badge" title="Has flags">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
							<path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/>
						</svg>
					</span>
				{/if}
			</div>

			<div class="assistant-content">
				{#each message.content as block, index}
					{#if block.type === 'text'}
						<TextBlock content={block} editedText={editRecord?.currentText} />
					{:else if block.type === 'thinking'}
						<ThinkingBlock content={block} />
					{:else if block.type === 'tool_use'}
						<ToolUseBlock content={block} allArtifactVersions={getArtifactVersions(block)} />
					{:else if block.type === 'tool_result'}
						<ToolResultBlock content={block} />
					{:else if block.type === 'token_budget'}
						<TokenBudgetBlock content={block} />
					{/if}
				{/each}

				{#if editRecord}
					<span class="edited-badge">edited</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Right gutter for selection checkbox -->
	<div class="selection-gutter" class:visible={showActions || isSelected}>
		<label class="checkbox-wrapper" title="Select for export">
			<input
				type="checkbox"
				checked={isSelected}
				onclick={handleCheckboxClick}
			/>
			<span class="checkbox-icon">
				{#if isSelected}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
						<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
					</svg>
				{/if}
			</span>
		</label>
	</div>
</div>

{#if isEditing}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="editor-modal-backdrop" onclick={closeEditor}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="editor-modal" onclick={(e) => e.stopPropagation()}>
			<MessageEditor 
				{message} 
				onClose={closeEditor} 
				onSave={handleSave} 
			/>
		</div>
	</div>
{/if}

<style>
	/* Row container with right gutter for checkbox */
	.message-row {
		display: flex;
		align-items: flex-start;
		gap: var(--cdv-space-2);
	}

	/* Right gutter - consistent position for checkbox */
	.selection-gutter {
		width: 28px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding-top: var(--cdv-space-2);
		opacity: 0;
		transition: opacity var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.selection-gutter.visible {
		opacity: 1;
	}

	.message {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: flex-start;
		gap: var(--cdv-space-2);
	}

	/* Human messages - right aligned dark bubble */
	.human-message {
		justify-content: flex-end;
	}

	.human-bubble {
		max-width: 80%;
		background-color: var(--cdv-color-stone-800);
		border-radius: var(--cdv-radius-2xl);
		border-bottom-right-radius: var(--cdv-radius-sm);
		padding: var(--cdv-space-3) var(--cdv-space-4);
		position: relative;
	}

	.human-text {
		font-size: var(--cdv-font-size-md);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-stone-100);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.attachments-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--cdv-space-2);
		margin-bottom: var(--cdv-space-3);
	}

	/* Assistant messages - left aligned, no bubble */
	.assistant-message {
		flex-direction: row;
	}

	.assistant-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-4);
	}

	/* Message actions (edit button, flags) */
	.message-actions {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-1);
		opacity: 0;
		transition: opacity var(--cdv-transition-fast) var(--cdv-ease-default);
		flex-shrink: 0;
	}

	.message-actions.visible {
		opacity: 1;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		cursor: pointer;
	}

	.checkbox-wrapper input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.checkbox-icon {
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

	.checkbox-wrapper:hover .checkbox-icon {
		border-color: var(--cdv-color-brand-500);
	}

	.checkbox-wrapper input:checked + .checkbox-icon {
		background-color: var(--cdv-color-brand-500);
		border-color: var(--cdv-color-brand-500);
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: none;
		border-radius: var(--cdv-radius-md);
		color: var(--cdv-color-text-tertiary);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.action-btn:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}

	.flags-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		color: var(--cdv-color-warning-500);
	}

	.edited-badge {
		display: inline-block;
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
		font-style: italic;
		margin-top: var(--cdv-space-1);
	}

	/* Selected state */
	.message-row.selected .human-bubble {
		box-shadow: 0 0 0 2px var(--cdv-color-brand-400);
	}

	.message-row.selected .assistant-content {
		background-color: var(--cdv-color-brand-50);
		margin: calc(-1 * var(--cdv-space-3));
		padding: var(--cdv-space-3);
		border-radius: var(--cdv-radius-xl);
	}

	:global(.dark) .message-row.selected .assistant-content {
		background-color: rgba(217, 119, 87, 0.1);
	}

	/* Editor modal */
	.editor-modal-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--cdv-z-modal);
		padding: var(--cdv-space-4);
	}

	.editor-modal {
		width: 100%;
		max-width: 700px;
		max-height: 90vh;
		overflow: auto;
		animation: modalIn var(--cdv-transition-normal) var(--cdv-ease-out);
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

	@media (max-width: 768px) {
		.human-bubble {
			max-width: 95%;
		}

		.selection-gutter,
		.message-actions {
			opacity: 1;
		}
	}
</style>
