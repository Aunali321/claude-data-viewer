<script lang="ts">
	import type { Attachment, StoredImage } from '$lib/types';
	import { getImage, getImageByFilename } from '$lib/db';
	
	interface Props {
		attachment: Attachment;
		exportId: string;
		compact?: boolean;
	}
	
	let { attachment, exportId, compact = false }: Props = $props();
	let isModalOpen = $state(false);
	let fetchedImage = $state<StoredImage | null>(null);
	
	let isImage = $derived(
		attachment.file_type.startsWith('image/') ||
		['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(attachment.file_type.toLowerCase())
	);
	
	// Check if image has been fetched from API
	$effect(() => {
		if (attachment.isMissingData && isImage) {
			loadFetchedImage();
		}
	});
	
	async function loadFetchedImage() {
		// Try to match by file_uuid first, then by filename
		if (attachment.file_uuid) {
			const img = await getImage(attachment.file_uuid);
			if (img) {
				fetchedImage = img;
				return;
			}
		}
		
		// Fallback to filename matching
		const img = await getImageByFilename(exportId, attachment.file_name);
		fetchedImage = img || null;
	}
	
	function formatFileSize(bytes: number): string {
		if (!bytes || bytes === 0) return 'Unknown size';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	
	function getFileIcon(): string {
		const type = attachment.file_type.toLowerCase();
		if (type === 'pdf' || type === 'application/pdf') return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z';
		if (isImage) return 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11';
		if (['doc', 'docx', 'txt', 'md', 'text/plain', 'text/markdown'].includes(type)) return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z';
		return 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z';
	}
	
	function getPreviewLines(): string[] {
		if (!attachment.extracted_content) return [];
		return attachment.extracted_content.split('\n').slice(0, 5);
	}
	
	function openModal() {
		isModalOpen = true;
	}
	
	function closeModal() {
		isModalOpen = false;
	}
</script>

{#if compact}
	<!-- Compact mode for human message bubbles -->
	{#if fetchedImage}
		<!-- Show fetched image inline -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<img 
			src="data:{fetchedImage.mimeType};base64,{fetchedImage.data}" 
			alt={attachment.file_name}
			class="compact-image"
			onclick={openModal}
			title="Click to view full size"
		/>
	{:else}
		<button class="attachment-compact" class:missing-data={attachment.isMissingData} onclick={openModal}>
			<div class="compact-icon" class:warning={attachment.isMissingData && isImage}>
				{#if attachment.isMissingData && isImage}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linecap="round" stroke-linejoin="round"/>
						<line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round"/>
						<line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round"/>
					</svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d={getFileIcon()} stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				{/if}
			</div>
			<div class="compact-info">
				<span class="compact-name">{attachment.file_name}</span>
				<span class="compact-meta">
					{#if attachment.isMissingData && isImage}
						<span class="missing-badge">Image not in export</span>
					{:else}
						{attachment.file_type.toUpperCase()} • {formatFileSize(attachment.file_size)}
					{/if}
				</span>
			</div>
		</button>
	{/if}
{:else}
	<!-- Full card mode -->
	{#if fetchedImage}
		<!-- Show fetched image -->
		<div class="attachment-card">
			<div class="card-header">
				<div class="file-icon">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d={getFileIcon()} stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</div>
				<div class="file-info">
					<span class="file-name">{attachment.file_name}</span>
					<span class="file-meta">
						{fetchedImage.mimeType.toUpperCase()} • Fetched from Claude
					</span>
				</div>
				<button class="expand-btn" onclick={openModal} title="View full image">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="15,3 21,3 21,9" stroke-linecap="round" stroke-linejoin="round"/>
						<polyline points="9,21 3,21 3,15" stroke-linecap="round" stroke-linejoin="round"/>
						<line x1="21" y1="3" x2="14" y2="10" stroke-linecap="round"/>
						<line x1="3" y1="21" x2="10" y2="14" stroke-linecap="round"/>
					</svg>
				</button>
			</div>
			<div class="card-image-preview">
				<img 
					src="data:{fetchedImage.mimeType};base64,{fetchedImage.data}" 
					alt={attachment.file_name}
					class="preview-image"
				/>
			</div>
		</div>
	{:else}
		<div class="attachment-card" class:missing-data={attachment.isMissingData}>
			<div class="card-header">
				<div class="file-icon" class:warning={attachment.isMissingData && isImage}>
					{#if attachment.isMissingData && isImage}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linecap="round" stroke-linejoin="round"/>
							<line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round"/>
							<line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round"/>
						</svg>
					{:else}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d={getFileIcon()} stroke-linecap="round" stroke-linejoin="round"/>
							{#if attachment.file_type.toLowerCase() === 'pdf'}
								<polyline points="14,2 14,8 20,8" stroke-linecap="round" stroke-linejoin="round"/>
							{/if}
						</svg>
					{/if}
				</div>
				<div class="file-info">
					<span class="file-name">{attachment.file_name}</span>
					<span class="file-meta">
						{#if attachment.isMissingData && isImage}
							<span class="missing-badge">Image not included in Claude export</span>
						{:else}
							{attachment.file_type.toUpperCase()} • {formatFileSize(attachment.file_size)}
						{/if}
					</span>
				</div>
				{#if !attachment.isMissingData || attachment.extracted_content}
					<button class="expand-btn" onclick={openModal} title="View full content">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="15,3 21,3 21,9" stroke-linecap="round" stroke-linejoin="round"/>
							<polyline points="9,21 3,21 3,15" stroke-linecap="round" stroke-linejoin="round"/>
							<line x1="21" y1="3" x2="14" y2="10" stroke-linecap="round"/>
							<line x1="3" y1="21" x2="10" y2="14" stroke-linecap="round"/>
						</svg>
					</button>
				{/if}
			</div>
			
			{#if attachment.isMissingData && isImage}
				<div class="missing-warning">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<line x1="12" y1="8" x2="12" y2="12" stroke-linecap="round"/>
						<line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round"/>
					</svg>
					<span>Claude's data export does not include image binary data. Only the filename is preserved.</span>
				</div>
			{:else if attachment.extracted_content}
				<div class="card-preview">
					{#each getPreviewLines() as line}
						<div class="preview-line">{line}</div>
					{/each}
					{#if attachment.extracted_content.split('\n').length > 5}
						<div class="preview-more">...</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
{/if}

{#if isModalOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="modal-backdrop" onclick={closeModal}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<div class="modal-file-info">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d={getFileIcon()} stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<div>
						<div class="modal-file-name">{attachment.file_name}</div>
						<div class="modal-file-meta">{attachment.file_type.toUpperCase()} • {formatFileSize(attachment.file_size)}</div>
					</div>
				</div>
				<button class="modal-close" onclick={closeModal} aria-label="Close modal">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round"/>
						<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/>
					</svg>
				</button>
			</div>
			<div class="modal-body">
				{#if fetchedImage}
					<img 
						src="data:{fetchedImage.mimeType};base64,{fetchedImage.data}" 
						alt={attachment.file_name}
						class="modal-image"
					/>
				{:else}
					<pre class="extracted-content">{attachment.extracted_content || 'No extracted content available.'}</pre>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Compact mode */
	.compact-image {
		max-width: 100%;
		max-height: 300px;
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		transition: transform var(--cdv-transition-fast) var(--cdv-ease-default);
		display: block;
	}
	
	.compact-image:hover {
		transform: scale(1.02);
	}
	
	.attachment-compact {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		background-color: var(--cdv-color-bg-base);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
		text-align: left;
	}
	
	.attachment-compact:hover {
		background-color: var(--cdv-color-bg-hover);
		border-color: var(--cdv-color-border-default);
	}
	
	.attachment-compact.missing-data {
		border-color: var(--cdv-color-warning-muted);
		background-color: color-mix(in srgb, var(--cdv-color-warning-500) 5%, transparent);
	}
	
	.compact-icon {
		flex-shrink: 0;
		color: var(--cdv-color-info-500);
	}
	
	.compact-icon.warning {
		color: var(--cdv-color-warning-500);
	}
	
	.compact-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	
	.compact-name {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.compact-meta {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}
	
	.missing-badge {
		color: var(--cdv-color-warning-500);
		font-weight: var(--cdv-font-weight-medium);
	}
	
	/* Full card mode */
	.attachment-card {
		background-color: var(--cdv-color-bg-elevated);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-xl);
		overflow: hidden;
	}
	
	.attachment-card.missing-data {
		border-color: var(--cdv-color-warning-muted);
	}
	
	.card-header {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		padding: var(--cdv-space-3) var(--cdv-space-4);
	}
	
	.file-icon {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--cdv-color-info-muted);
		color: var(--cdv-color-info-500);
		border-radius: var(--cdv-radius-lg);
	}
	
	.file-icon.warning {
		background-color: var(--cdv-color-warning-muted);
		color: var(--cdv-color-warning-500);
	}
	
	.file-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	
	.file-name {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.file-meta {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}
	
	.missing-warning {
		display: flex;
		align-items: flex-start;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-3) var(--cdv-space-4);
		background-color: var(--cdv-color-warning-muted);
		border-top: 1px solid var(--cdv-color-warning-muted);
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-warning-500);
		line-height: var(--cdv-line-height-normal);
	}
	
	.missing-warning svg {
		flex-shrink: 0;
		margin-top: 1px;
	}
	
	.expand-btn {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-md);
		color: var(--cdv-color-text-tertiary);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.expand-btn:hover {
		background-color: var(--cdv-color-bg-hover);
		border-color: var(--cdv-color-border-default);
		color: var(--cdv-color-text-primary);
	}
	
	.card-preview {
		padding: var(--cdv-space-3) var(--cdv-space-4);
		background-color: var(--cdv-color-bg-base);
		border-top: 1px solid var(--cdv-color-border-subtle);
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-xs);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-secondary);
		max-height: 120px;
		overflow: hidden;
	}
	
	.card-image-preview {
		padding: var(--cdv-space-3);
		background-color: var(--cdv-color-bg-base);
		border-top: 1px solid var(--cdv-color-border-subtle);
		display: flex;
		justify-content: center;
		align-items: center;
	}
	
	.preview-image {
		max-width: 100%;
		max-height: 200px;
		border-radius: var(--cdv-radius-md);
		display: block;
	}
	
	.preview-line {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.preview-more {
		color: var(--cdv-color-text-tertiary);
		margin-top: var(--cdv-space-1);
	}
	
	/* Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--cdv-z-modal);
		padding: var(--cdv-space-4);
	}
	
	.modal-content {
		width: 100%;
		max-width: 900px;
		max-height: 90vh;
		background-color: var(--cdv-color-bg-raised);
		border-radius: var(--cdv-radius-xl);
		display: flex;
		flex-direction: column;
		overflow: hidden;
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
	
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--cdv-space-4);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
	}
	
	.modal-file-info {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		color: var(--cdv-color-info-500);
	}
	
	.modal-file-name {
		font-size: var(--cdv-font-size-base);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-primary);
	}
	
	.modal-file-meta {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
	}
	
	.modal-close {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--cdv-color-text-tertiary);
		cursor: pointer;
		border-radius: var(--cdv-radius-md);
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.modal-close:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}
	
	.modal-body {
		flex: 1;
		overflow: auto;
		padding: var(--cdv-space-4);
	}
	
	.extracted-content {
		margin: 0;
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-sm);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-primary);
		white-space: pre-wrap;
		word-break: break-word;
	}
	
	.modal-image {
		max-width: 100%;
		max-height: 70vh;
		display: block;
		margin: 0 auto;
		border-radius: var(--cdv-radius-lg);
	}
</style>
