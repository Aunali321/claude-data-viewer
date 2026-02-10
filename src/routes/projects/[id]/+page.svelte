<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import type { Project, ProjectDoc } from '$lib/types';

	let projectId = $derived($page.params.id);
	let project = $state<Project | null>(null);
	let exportName = $state<string>('');
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let expandedDocs = $state<Set<string>>(new Set());
	let showFullPrompt = $state(false);

	async function loadProject() {
		isLoading = true;
		error = null;

		if (!projectId) {
			error = 'No project ID provided';
			isLoading = false;
			return;
		}

		try {
			// Search through all exports to find the project
			const allExports = await db.exports.toArray();

			for (const exp of allExports) {
				const found = exp.projects.find(p => p.uuid === projectId);
				if (found) {
					project = found;
					exportName = exp.user.full_name;
					break;
				}
			}

			if (!project) {
				error = 'Project not found';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load project';
		} finally {
			isLoading = false;
		}
	}

	function goBack() {
		goto('/projects');
	}

	function toggleDoc(uuid: string) {
		expandedDocs = new Set(expandedDocs);
		if (expandedDocs.has(uuid)) {
			expandedDocs.delete(uuid);
		} else {
			expandedDocs.add(uuid);
		}
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	$effect(() => {
		if (projectId) {
			loadProject();
		}
	});
</script>

<div class="page">
	<!-- Top bar -->
	<header class="topbar">
		<div class="topbar-left">
			<button class="back-btn" onclick={goBack}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>Back</span>
			</button>
			{#if project}
				<h1 class="title">{project.name}</h1>
			{/if}
		</div>

		<div class="topbar-right">
			{#if project}
				<div class="badges">
					{#if project.is_private}
						<span class="badge">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
								<path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
							Private
						</span>
					{/if}
					{#if project.is_starter_project}
						<span class="badge badge-accent">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
							Starter
						</span>
					{/if}
				</div>
			{/if}
		</div>
	</header>

	<!-- Content -->
	<main class="content">
		{#if isLoading}
			<div class="center-state">
				<div class="spinner"></div>
			</div>
		{:else if error}
			<div class="center-state">
				<p class="error-text">{error}</p>
				<button class="primary-btn" onclick={goBack}>Go Back</button>
			</div>
		{:else if project}
			<div class="project-content">
				<!-- Description -->
				{#if project.description}
					<section class="section">
						<h2 class="section-title">Description</h2>
						<p class="description">{project.description}</p>
					</section>
				{/if}

				<!-- Meta info -->
				<section class="section meta-section">
					<div class="meta-grid">
						<div class="meta-item">
							<span class="meta-label">Created by</span>
							<span class="meta-value">{project.creator.full_name}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Created</span>
							<span class="meta-value">{formatDate(project.created_at)}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Updated</span>
							<span class="meta-value">{formatDate(project.updated_at)}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Export</span>
							<span class="meta-value">{exportName}</span>
						</div>
					</div>
				</section>

				<!-- System Prompt -->
				{#if project.prompt_template}
					<section class="section">
						<div class="section-header">
							<h2 class="section-title">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
									<polyline points="14,2 14,8 20,8" stroke-linecap="round" stroke-linejoin="round"/>
									<line x1="16" y1="13" x2="8" y2="13" stroke-linecap="round"/>
									<line x1="16" y1="17" x2="8" y2="17" stroke-linecap="round"/>
									<line x1="10" y1="9" x2="8" y2="9" stroke-linecap="round"/>
								</svg>
								System Prompt
							</h2>
							<button class="copy-btn" onclick={() => copyToClipboard(project.prompt_template)} title="Copy to clipboard">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
									<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</button>
						</div>
						<div class="prompt-container" class:expanded={showFullPrompt}>
							<pre class="prompt-text">{project.prompt_template}</pre>
							{#if project.prompt_template.length > 500 && !showFullPrompt}
								<div class="prompt-fade"></div>
							{/if}
						</div>
						{#if project.prompt_template.length > 500}
							<button class="expand-btn" onclick={() => showFullPrompt = !showFullPrompt}>
								{showFullPrompt ? 'Show less' : 'Show more'}
							</button>
						{/if}
					</section>
				{/if}

				<!-- Documents -->
				{#if project.docs.length > 0}
					<section class="section">
						<h2 class="section-title">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
								<polyline points="14,2 14,8 20,8" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
							Documents ({project.docs.length})
						</h2>
						<div class="docs-list">
							{#each project.docs as doc (doc.uuid)}
								<div class="doc-item">
									<button class="doc-header" onclick={() => toggleDoc(doc.uuid)}>
										<svg class="doc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
											<polyline points="14,2 14,8 20,8" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
										<span class="doc-name">{doc.filename}</span>
										<span class="doc-size">{(doc.content.length / 1024).toFixed(1)}KB</span>
										<svg class="chevron" class:expanded={expandedDocs.has(doc.uuid)} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<polyline points="6,9 12,15 18,9" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									</button>
									{#if expandedDocs.has(doc.uuid)}
										<div class="doc-content">
											<div class="doc-actions">
												<button class="copy-btn" onclick={() => copyToClipboard(doc.content)} title="Copy content">
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
														<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round" stroke-linejoin="round"/>
													</svg>
													Copy
												</button>
											</div>
											<pre class="doc-text">{doc.content}</pre>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<!-- No content state -->
				{#if !project.description && !project.prompt_template && project.docs.length === 0}
					<div class="empty-project">
						<p>This project has no description, system prompt, or documents.</p>
					</div>
				{/if}
			</div>
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: var(--cdv-color-bg-base);
	}

	/* Top bar */
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--cdv-space-3) var(--cdv-space-5);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
		background-color: var(--cdv-color-bg-base);
		position: sticky;
		top: 0;
		z-index: var(--cdv-z-sticky);
	}

	.topbar-left {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		min-width: 0;
		flex: 1;
	}

	.topbar-right {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		flex-shrink: 0;
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		background: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-full);
		color: var(--cdv-color-text-secondary);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: var(--cdv-shadow-sm);
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.back-btn:hover {
		background: var(--cdv-color-surface-primary);
		border-color: var(--cdv-color-border-default);
		color: var(--cdv-color-text-primary);
		box-shadow: var(--cdv-shadow-md);
	}

	.title {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.badges {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
	}

	.badge {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-1);
		padding: var(--cdv-space-1) var(--cdv-space-2);
		background-color: var(--cdv-color-bg-muted);
		border-radius: var(--cdv-radius-full);
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-secondary);
	}

	.badge-accent {
		background-color: var(--cdv-color-accent-100);
		color: var(--cdv-color-accent-700);
	}

	:global(.dark) .badge-accent {
		background-color: rgba(245, 158, 11, 0.15);
		color: var(--cdv-color-accent-400);
	}

	/* Content */
	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.center-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-4);
		padding: var(--cdv-space-16);
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--cdv-color-border-subtle);
		border-top-color: var(--cdv-color-brand-500);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-text {
		color: var(--cdv-color-text-secondary);
		margin: 0;
	}

	.primary-btn {
		padding: var(--cdv-space-2) var(--cdv-space-4);
		background-color: var(--cdv-color-brand-500);
		border: none;
		border-radius: var(--cdv-radius-lg);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: white;
		cursor: pointer;
	}

	.primary-btn:hover {
		background-color: var(--cdv-color-brand-600);
	}

	.project-content {
		max-width: 800px;
		width: 100%;
		margin: 0 auto;
		padding: var(--cdv-space-8) var(--cdv-space-5);
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-8);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-3);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.section-title svg {
		color: var(--cdv-color-text-tertiary);
	}

	.description {
		font-size: var(--cdv-font-size-base);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-primary);
		margin: 0;
	}

	/* Meta section */
	.meta-section {
		padding: var(--cdv-space-4);
		background-color: var(--cdv-color-bg-raised);
		border-radius: var(--cdv-radius-xl);
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--cdv-space-4);
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-1);
	}

	.meta-label {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.meta-value {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-primary);
	}

	/* Prompt */
	.prompt-container {
		position: relative;
		max-height: 200px;
		overflow: hidden;
		background-color: var(--cdv-color-bg-raised);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-lg);
	}

	.prompt-container.expanded {
		max-height: none;
	}

	.prompt-text {
		margin: 0;
		padding: var(--cdv-space-4);
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-sm);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-primary);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.prompt-fade {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 60px;
		background: linear-gradient(to bottom, transparent, var(--cdv-color-bg-raised));
		pointer-events: none;
	}

	.expand-btn {
		align-self: flex-start;
		padding: var(--cdv-space-1) var(--cdv-space-2);
		background: transparent;
		border: none;
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-brand-500);
		cursor: pointer;
	}

	.expand-btn:hover {
		color: var(--cdv-color-brand-600);
		text-decoration: underline;
	}

	.copy-btn {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-1);
		padding: var(--cdv-space-1) var(--cdv-space-2);
		background: transparent;
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-md);
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.copy-btn:hover {
		border-color: var(--cdv-color-border-default);
		color: var(--cdv-color-text-primary);
		background-color: var(--cdv-color-bg-hover);
	}

	/* Documents */
	.docs-list {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-2);
	}

	.doc-item {
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-lg);
		overflow: hidden;
	}

	.doc-header {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		width: 100%;
		padding: var(--cdv-space-3) var(--cdv-space-4);
		background-color: var(--cdv-color-surface-primary);
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background-color var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.doc-header:hover {
		background-color: var(--cdv-color-bg-hover);
	}

	.doc-icon {
		color: var(--cdv-color-text-tertiary);
		flex-shrink: 0;
	}

	.doc-name {
		flex: 1;
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.doc-size {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}

	.chevron {
		color: var(--cdv-color-text-tertiary);
		transition: transform var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.chevron.expanded {
		transform: rotate(180deg);
	}

	.doc-content {
		border-top: 1px solid var(--cdv-color-border-subtle);
		background-color: var(--cdv-color-bg-raised);
	}

	.doc-actions {
		display: flex;
		justify-content: flex-end;
		padding: var(--cdv-space-2) var(--cdv-space-4);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
	}

	.doc-text {
		margin: 0;
		padding: var(--cdv-space-4);
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-xs);
		line-height: var(--cdv-line-height-relaxed);
		color: var(--cdv-color-text-primary);
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 400px;
		overflow: auto;
	}

	.empty-project {
		text-align: center;
		padding: var(--cdv-space-8);
		color: var(--cdv-color-text-tertiary);
	}

	@media (max-width: 768px) {
		.topbar {
			padding: var(--cdv-space-2) var(--cdv-space-3);
		}

		.project-content {
			padding: var(--cdv-space-4) var(--cdv-space-3);
		}

		.meta-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
