<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { importZipFile, type ImportProgress } from '$lib/db/import';
	import { exports, addExport, currentExportId } from '$lib/stores/app';
	import { theme } from '$lib/stores/theme';
	import FileDropZone from '$lib/components/shared/FileDropZone.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import ImageFetchModal from '$lib/components/images/ImageFetchModal.svelte';
	import { findConversationsWithImages } from '$lib/utils/images';
	import { onMount } from 'svelte';

	let importProgress = $state<ImportProgress | null>(null);
	let isImporting = $state(false);
	let recentImports = $state<Array<{ name: string; success: boolean; count: number; exportId?: string; pendingImages?: number }>>([]);
	let showImageModal = $state(false);
	let imageModalExportId = $state('');
	let imageModalExportName = $state('');

	// Check if we have existing data
	let hasExistingData = $derived($exports.length > 0);

	async function handleFilesSelected(files: File[]) {
		if (files.length === 0) return;

		isImporting = true;
		recentImports = [];

		for (const file of files) {
			if (!file.name.endsWith('.zip')) {
				recentImports = [
					...recentImports,
					{ name: file.name, success: false, count: 0 }
				];
				continue;
			}

			const result = await importZipFile(file, (progress) => {
				importProgress = progress;
			});

			let pendingImages = 0;
			if (result.success) {
				const conversations = await findConversationsWithImages(result.exportId);
				pendingImages = conversations.size;
			}

			recentImports = [
				...recentImports,
				{
					name: result.exportName,
					success: result.success,
					count: result.conversationCount,
					exportId: result.success ? result.exportId : undefined,
					pendingImages
				}
			];

			if (result.success) {
				// Fetch the created export and add to store
				const exportRecord = await db.exports.get(result.exportId);
				if (exportRecord) {
					addExport(exportRecord);
				}
			}
		}

		isImporting = false;
		importProgress = null;
	}

	function goToConversations() {
		goto('/conversations');
	}
	
	function openImageFetchModal(exportId: string, exportName: string) {
		imageModalExportId = exportId;
		imageModalExportName = exportName;
		showImageModal = true;
	}
	
	function closeImageFetchModal() {
		showImageModal = false;
	}
	
	function onImageFetchComplete() {
		// Refresh the pending counts
		recentImports = recentImports.map(r => {
			if (r.exportId === imageModalExportId) {
				return { ...r, pendingImages: 0 };
			}
			return r;
		});
	}
</script>

<div class="landing-page">
	<Header />

	<main class="main-content">
		{#if !hasExistingData && !isImporting && recentImports.length === 0}
			<!-- Empty state - first time user -->
			<div class="hero-section animate-fade-in">
				<div class="hero-icon">
					<svg
						width="80"
						height="80"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<polyline
							points="17,8 12,3 7,8"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<line x1="12" y1="3" x2="12" y2="15" stroke-linecap="round" />
					</svg>
				</div>

				<h1 class="hero-title">Claude Data Viewer</h1>
				<p class="hero-subtitle">
					View, review, and export your Claude.ai conversations.<br />
					Drop your export zip files to get started.
				</p>
			</div>
		{/if}

		<div class="drop-zone-container" class:compact={hasExistingData || recentImports.length > 0}>
			<FileDropZone
				onFilesSelected={handleFilesSelected}
				accept=".zip"
				multiple={true}
				disabled={isImporting}
			>
				{#if isImporting && importProgress}
					<div class="import-progress">
						<div class="progress-spinner"></div>
						<p class="progress-message">{importProgress.message}</p>
						<div class="progress-bar-container">
							<div
								class="progress-bar"
								style="width: {importProgress.progress}%"
							></div>
						</div>
						{#if importProgress.details}
							<p class="progress-details">
								{importProgress.details.conversationsProcessed ?? 0} /
								{importProgress.details.totalConversations ?? 0} conversations
							</p>
						{/if}
					</div>
				{:else}
					<div class="drop-zone-content">
						<div class="drop-icon">
							<svg
								width="48"
								height="48"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<polyline
									points="17,8 12,3 7,8"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<line x1="12" y1="3" x2="12" y2="15" stroke-linecap="round" />
							</svg>
						</div>
						<p class="drop-text">
							{#if hasExistingData}
								Drop more export files here
							{:else}
								Drop Claude export zip files here
							{/if}
						</p>
						<p class="drop-subtext">or click to browse</p>
					</div>
				{/if}
			</FileDropZone>
		</div>

		{#if recentImports.length > 0}
			<div class="import-results animate-slide-up">
				<h3 class="results-title">Import Results</h3>
				<ul class="results-list">
					{#each recentImports as result}
						<li class="result-item" class:success={result.success} class:error={!result.success}>
							<span class="result-icon">
								{#if result.success}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="20,6 9,17 4,12" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								{:else}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round"/>
										<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/>
									</svg>
								{/if}
							</span>
							<span class="result-name">{result.name}</span>
							{#if result.success}
								<span class="result-count">{result.count} conversations</span>
								{#if result.pendingImages && result.pendingImages > 0 && result.exportId}
									<button 
										class="fetch-images-btn"
										onclick={() => openImageFetchModal(result.exportId!, result.name)}
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
											<circle cx="8.5" cy="8.5" r="1.5"/>
											<polyline points="21,15 16,10 5,21"/>
										</svg>
										{result.pendingImages} images
									</button>
								{/if}
							{:else}
								<span class="result-error">Failed to import</span>
							{/if}
						</li>
					{/each}
				</ul>

				{#if recentImports.some(r => r.success)}
					<button class="btn btn-primary go-button" onclick={goToConversations}>
						View Conversations
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="5" y1="12" x2="19" y2="12" stroke-linecap="round"/>
							<polyline points="12,5 19,12 12,19" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</button>
				{/if}
			</div>
		{/if}

		{#if hasExistingData && recentImports.length === 0}
			<div class="existing-data animate-fade-in">
				<p class="existing-text">
					You have <strong>{$exports.length}</strong> export{$exports.length !== 1 ? 's' : ''} loaded
				</p>
				<button class="btn btn-primary" onclick={goToConversations}>
					View Conversations
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="5" y1="12" x2="19" y2="12" stroke-linecap="round"/>
						<polyline points="12,5 19,12 12,19" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			</div>
		{/if}
	</main>

	<footer class="footer">
		<p class="footer-text">
			All data stays in your browser. Nothing is sent to any server.
		</p>
	</footer>
</div>

{#if showImageModal}
	<ImageFetchModal 
		exportId={imageModalExportId}
		exportName={imageModalExportName}
		onClose={closeImageFetchModal}
		onComplete={onImageFetchComplete}
	/>
{/if}

<style>
	.landing-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: var(--cdv-color-bg-base);
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--cdv-space-8);
		gap: var(--cdv-space-8);
	}

	.hero-section {
		text-align: center;
		max-width: 500px;
	}

	.hero-icon {
		color: var(--cdv-color-accent-500);
		margin-bottom: var(--cdv-space-6);
		opacity: 0.9;
	}

	.hero-title {
		font-size: var(--cdv-font-size-4xl);
		font-weight: var(--cdv-font-weight-bold);
		color: var(--cdv-color-text-primary);
		margin: 0 0 var(--cdv-space-4) 0;
		letter-spacing: var(--cdv-letter-spacing-tight);
	}

	.hero-subtitle {
		font-size: var(--cdv-font-size-lg);
		color: var(--cdv-color-text-secondary);
		margin: 0;
		line-height: var(--cdv-line-height-relaxed);
	}

	.drop-zone-container {
		width: 100%;
		max-width: 600px;
	}

	.drop-zone-container.compact {
		max-width: 500px;
	}

	.drop-zone-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--cdv-space-3);
	}

	.drop-icon {
		color: var(--cdv-color-text-tertiary);
		transition: color var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.drop-text {
		font-size: var(--cdv-font-size-lg);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
		margin: 0;
	}

	.drop-subtext {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
		margin: 0;
	}

	.import-progress {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--cdv-space-4);
		padding: var(--cdv-space-4);
	}

	.progress-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--cdv-color-border-subtle);
		border-top-color: var(--cdv-color-brand-500);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.progress-message {
		font-size: var(--cdv-font-size-base);
		color: var(--cdv-color-text-primary);
		margin: 0;
	}

	.progress-bar-container {
		width: 100%;
		max-width: 300px;
		height: 4px;
		background-color: var(--cdv-color-bg-elevated);
		border-radius: var(--cdv-radius-full);
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background-color: var(--cdv-color-brand-500);
		transition: width var(--cdv-transition-normal) var(--cdv-ease-out);
	}

	.progress-details {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
		margin: 0;
	}

	.import-results {
		width: 100%;
		max-width: 500px;
		background-color: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-xl);
		padding: var(--cdv-space-6);
	}

	.results-title {
		font-size: var(--cdv-font-size-lg);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-primary);
		margin: 0 0 var(--cdv-space-4) 0;
	}

	.results-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-2);
	}

	.result-item {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		padding: var(--cdv-space-3);
		background-color: var(--cdv-color-bg-raised);
		border-radius: var(--cdv-radius-md);
	}

	.result-item.success .result-icon {
		color: var(--cdv-color-success-500);
	}

	.result-item.error .result-icon {
		color: var(--cdv-color-error-500);
	}

	.result-name {
		flex: 1;
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
	}

	.result-count {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
	}

	.result-error {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-error-500);
	}

	.fetch-images-btn {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-1);
		padding: var(--cdv-space-1) var(--cdv-space-2);
		background-color: var(--cdv-color-info-50);
		color: var(--cdv-color-info-600);
		border: none;
		border-radius: var(--cdv-radius-md);
		font-size: var(--cdv-font-size-xs);
		font-weight: var(--cdv-font-weight-medium);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.fetch-images-btn:hover {
		background-color: var(--cdv-color-info-500);
		color: white;
	}

	.go-button {
		margin-top: var(--cdv-space-4);
		width: 100%;
	}

	.existing-data {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--cdv-space-4);
	}

	.existing-text {
		font-size: var(--cdv-font-size-base);
		color: var(--cdv-color-text-secondary);
		margin: 0;
	}

	.footer {
		padding: var(--cdv-space-4);
		text-align: center;
		border-top: 1px solid var(--cdv-color-border-subtle);
	}

	.footer-text {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
		margin: 0;
	}
</style>
