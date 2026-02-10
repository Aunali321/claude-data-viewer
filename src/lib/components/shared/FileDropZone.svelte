<script lang="ts">
	import type { Snippet } from 'svelte';
	
	interface Props {
		onFilesSelected: (files: File[]) => void;
		accept?: string;
		multiple?: boolean;
		disabled?: boolean;
		children?: Snippet;
	}
	
	let { 
		onFilesSelected, 
		accept = '*', 
		multiple = false, 
		disabled = false,
		children 
	}: Props = $props();
	
	let isDragOver = $state(false);
	let fileInput: HTMLInputElement;
	
	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!disabled) {
			isDragOver = true;
		}
	}
	
	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragOver = false;
	}
	
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!disabled) {
			isDragOver = true;
		}
	}
	
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragOver = false;
		
		if (disabled) return;
		
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			const fileArray = Array.from(files);
			onFilesSelected(multiple ? fileArray : [fileArray[0]]);
		}
	}
	
	function handleClick() {
		if (!disabled) {
			fileInput?.click();
		}
	}
	
	function handleKeyDown(e: KeyboardEvent) {
		if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
			e.preventDefault();
			fileInput?.click();
		}
	}
	
	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			const fileArray = Array.from(files);
			onFilesSelected(multiple ? fileArray : [fileArray[0]]);
		}
		// Reset input so same file can be selected again
		target.value = '';
	}
	
	function handlePaste(e: ClipboardEvent) {
		if (disabled) return;
		
		const items = e.clipboardData?.items;
		if (!items) return;
		
		const files: File[] = [];
		for (const item of items) {
			if (item.kind === 'file') {
				const file = item.getAsFile();
				if (file) files.push(file);
			}
		}
		
		if (files.length > 0) {
			onFilesSelected(multiple ? files : [files[0]]);
		}
	}
</script>

<svelte:window on:paste={handlePaste} />

<div
	class="drop-zone"
	class:drag-over={isDragOver}
	class:disabled={disabled}
	role="button"
	tabindex={disabled ? -1 : 0}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	onclick={handleClick}
	onkeydown={handleKeyDown}
>
	<input
		bind:this={fileInput}
		type="file"
		{accept}
		{multiple}
		{disabled}
		onchange={handleFileChange}
		class="file-input"
	/>
	
	{#if children}
		{@render children()}
	{:else}
		<div class="default-content">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round"/>
				<polyline points="17,8 12,3 7,8" stroke-linecap="round" stroke-linejoin="round"/>
				<line x1="12" y1="3" x2="12" y2="15" stroke-linecap="round"/>
			</svg>
			<p>Drop files here or click to browse</p>
		</div>
	{/if}
</div>

<style>
	.drop-zone {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		padding: var(--cdv-space-8);
		background-color: var(--cdv-color-surface-primary);
		border: 2px dashed var(--cdv-color-border-default);
		border-radius: var(--cdv-radius-xl);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}
	
	.drop-zone:hover:not(.disabled) {
		border-color: var(--cdv-color-brand-400);
		background-color: var(--cdv-color-surface-secondary);
	}
	
	.drop-zone:focus-visible {
		outline: none;
		border-color: var(--cdv-color-brand-500);
		box-shadow: var(--cdv-ring-focus);
	}

	.drop-zone.drag-over {
		border-color: var(--cdv-color-brand-500);
		background-color: var(--cdv-color-brand-50);
		border-style: solid;
	}
	
	.drop-zone.disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}
	
	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	
	.default-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--cdv-space-4);
		color: var(--cdv-color-text-tertiary);
	}
	
	.default-content p {
		margin: 0;
		font-size: var(--cdv-font-size-base);
	}
</style>
