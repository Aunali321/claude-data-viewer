<script lang="ts">
	import { db } from '$lib/db';
	import { exports, currentExportId, sidebarCollapsed } from '$lib/stores/app';
	import Header from '$lib/components/layout/Header.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import type { Project, ExportRecord } from '$lib/types';
	import { onMount } from 'svelte';

	interface ProjectWithExport extends Project {
		exportId: string;
		exportName: string;
	}

	let allProjects = $state<ProjectWithExport[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');

	// Filtered and sorted projects
	let filteredProjects = $derived.by(() => {
		let result = [...allProjects];

		// Filter by current export if selected
		const exportId = $currentExportId;
		if (exportId) {
			result = result.filter(p => p.exportId === exportId);
		}

		// Apply search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(p =>
				p.name.toLowerCase().includes(query) ||
				p.description.toLowerCase().includes(query)
			);
		}

		// Sort by updated date (newest first)
		result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

		return result;
	});

	async function loadProjects() {
		isLoading = true;
		try {
			const allExports = await db.exports.toArray();
			const projects: ProjectWithExport[] = [];

			for (const exp of allExports) {
				for (const project of exp.projects) {
					projects.push({
						...project,
						exportId: exp.id,
						exportName: exp.user.full_name
					});
				}
			}

			allProjects = projects;
		} catch (error) {
			console.error('Failed to load projects:', error);
		} finally {
			isLoading = false;
		}
	}

	function formatRelativeDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	onMount(() => {
		loadProjects();
	});

	// Reload when export changes
	$effect(() => {
		if ($currentExportId !== undefined) {
			// Just trigger re-filter, data is already loaded
		}
	});

	// Reload when exports change
	$effect(() => {
		if ($exports) {
			loadProjects();
		}
	});
</script>

<div class="page-container" class:sidebar-collapsed={$sidebarCollapsed}>
	<Sidebar />

	<div class="main-area">
		<Header />

		<div class="content">
			<div class="content-header">
				<div class="search-container">
					<svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" stroke-linecap="round" />
					</svg>
					<input
						type="text"
						class="search-input"
						placeholder="Search projects..."
						bind:value={searchQuery}
					/>
				</div>

				<div class="stats">
					<span class="stat-count">{filteredProjects.length}</span>
					<span class="stat-label">projects</span>
				</div>
			</div>

			{#if isLoading}
				<div class="loading-state">
					<div class="loading-spinner"></div>
					<p>Loading projects...</p>
				</div>
			{:else if filteredProjects.length === 0}
				<div class="empty-state">
					{#if allProjects.length === 0}
						<div class="empty-icon">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
						<p>No projects found.</p>
						<span class="empty-hint">Projects from your Claude.ai exports will appear here.</span>
					{:else}
						<p>No projects match your search.</p>
						<button class="btn btn-secondary" onclick={() => { searchQuery = ''; }}>
							Clear Search
						</button>
					{/if}
				</div>
			{:else}
				<ul class="project-list">
					{#each filteredProjects as project (project.uuid)}
						<li>
							<a href="/projects/{project.uuid}" class="project-item">
								<div class="project-icon">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								</div>

								<div class="project-main">
									<h3 class="project-name">{project.name}</h3>
									{#if project.description}
										<p class="project-description">{project.description}</p>
									{/if}
									<div class="project-meta">
										<span class="project-date">{formatRelativeDate(project.updated_at)}</span>
										{#if project.docs.length > 0}
											<span class="project-docs">{project.docs.length} doc{project.docs.length !== 1 ? 's' : ''}</span>
										{/if}
										{#if project.prompt_template}
											<span class="project-has-prompt">Has prompt</span>
										{/if}
									</div>
								</div>

								<div class="project-badges">
									{#if project.is_private}
										<span class="badge" title="Private">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
												<path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
										</span>
									{/if}
									{#if project.is_starter_project}
										<span class="badge badge-accent" title="Starter project">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
										</span>
									{/if}
								</div>

								<svg class="project-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="9,18 15,12 9,6" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<style>
	.page-container {
		display: flex;
		min-height: 100vh;
		background-color: var(--cdv-color-bg-base);
	}

	.main-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		margin-left: var(--cdv-sidebar-width);
		transition: margin-left var(--cdv-transition-slow) var(--cdv-ease-default);
	}

	.page-container.sidebar-collapsed .main-area {
		margin-left: 0;
	}

	.content {
		flex: 1;
		padding: var(--cdv-space-6);
		max-width: 1200px;
		width: 100%;
		margin: 0 auto;
	}

	.content-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--cdv-space-4);
		margin-bottom: var(--cdv-space-6);
	}

	.search-container {
		position: relative;
		flex: 1;
		max-width: 400px;
	}

	.search-icon {
		position: absolute;
		left: var(--cdv-space-3);
		top: 50%;
		transform: translateY(-50%);
		color: var(--cdv-color-text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: var(--cdv-space-2-5) var(--cdv-space-3) var(--cdv-space-2-5) var(--cdv-space-10);
		font-size: var(--cdv-font-size-sm);
		background-color: var(--cdv-color-bg-raised);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-lg);
		color: var(--cdv-color-text-primary);
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.search-input:hover {
		border-color: var(--cdv-color-border-default);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--cdv-color-brand-500);
		box-shadow: var(--cdv-ring-focus);
	}

	.search-input::placeholder {
		color: var(--cdv-color-text-tertiary);
	}

	.stats {
		display: flex;
		align-items: baseline;
		gap: var(--cdv-space-1-5);
	}

	.stat-count {
		font-size: var(--cdv-font-size-xl);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-primary);
	}

	.stat-label {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-4);
		padding: var(--cdv-space-16);
		color: var(--cdv-color-text-secondary);
	}

	.empty-icon {
		color: var(--cdv-color-text-tertiary);
		opacity: 0.5;
	}

	.empty-hint {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--cdv-color-border-subtle);
		border-top-color: var(--cdv-color-brand-500);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.project-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-2);
	}

	.project-item {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-4);
		width: 100%;
		padding: var(--cdv-space-4);
		background-color: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-xl);
		cursor: pointer;
		text-decoration: none;
		box-shadow: var(--cdv-shadow-xs);
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.project-item:hover {
		background-color: var(--cdv-color-surface-primary);
		border-color: var(--cdv-color-border-default);
		box-shadow: var(--cdv-shadow-md);
		transform: translateY(-1px);
	}

	.project-item:focus-visible {
		outline: none;
		border-color: var(--cdv-color-brand-500);
		box-shadow: var(--cdv-ring-focus);
	}

	.project-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background-color: var(--cdv-color-brand-50);
		border-radius: var(--cdv-radius-lg);
		color: var(--cdv-color-brand-600);
		flex-shrink: 0;
	}

	:global(.dark) .project-icon {
		background-color: var(--cdv-color-brand-900);
		color: var(--cdv-color-brand-400);
	}

	.project-main {
		flex: 1;
		min-width: 0;
	}

	.project-name {
		font-size: var(--cdv-font-size-base);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
		margin: 0 0 var(--cdv-space-1) 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.project-description {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		margin: 0 0 var(--cdv-space-2) 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.project-meta {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
	}

	.project-date,
	.project-docs,
	.project-has-prompt {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}

	.project-has-prompt {
		color: var(--cdv-color-brand-500);
	}

	.project-badges {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-1-5);
	}

	.badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background-color: var(--cdv-color-bg-muted);
		border-radius: var(--cdv-radius-lg);
		color: var(--cdv-color-text-secondary);
	}

	.badge svg {
		width: 18px;
		height: 18px;
	}

	.badge-accent {
		background-color: var(--cdv-color-accent-100);
		color: var(--cdv-color-accent-600);
	}

	:global(.dark) .badge-accent {
		background-color: rgba(245, 158, 11, 0.15);
		color: var(--cdv-color-accent-400);
	}

	.project-arrow {
		color: var(--cdv-color-text-tertiary);
		opacity: 0;
		transition: opacity var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.project-item:hover .project-arrow {
		opacity: 1;
	}

	.btn {
		padding: var(--cdv-space-2) var(--cdv-space-4);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.btn-secondary {
		background-color: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-default);
		color: var(--cdv-color-text-secondary);
	}

	.btn-secondary:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}

	@media (max-width: 768px) {
		.main-area {
			margin-left: 0;
		}

		.content {
			padding: var(--cdv-space-4);
		}

		.content-header {
			flex-direction: column;
			align-items: stretch;
		}

		.search-container {
			max-width: none;
		}

		.stats {
			justify-content: center;
		}

		.project-badges {
			display: none;
		}
	}
</style>
