<script lang="ts">
	import { exports, currentExportId, filters, sidebarCollapsed, resetFilters, removeExport, initializeStores } from '$lib/stores/app';
	import { deleteExport } from '$lib/db';
	import { saveBackup, restoreBackup, inspectBackup } from '$lib/db/backup';
	import type { FilterState } from '$lib/types';
	import type { ExportRecord } from '$lib/types';

	let isCollapsed = $derived($sidebarCollapsed);
	let exportToDelete = $state<ExportRecord | null>(null);
	let currentFilters = $derived($filters);
	let allExports = $derived($exports);
	let selectedExportId = $derived($currentExportId);

	// Backup / restore state
	let fileInput = $state<HTMLInputElement | null>(null);
	let isBackingUp = $state(false);
	let isRestoring = $state(false);
	let restoreCandidate = $state<{ file: File; rowCount: number } | null>(null);
	let backupError = $state<string | null>(null);

	function toggleSidebar() {
		sidebarCollapsed.update(v => !v);
	}

	function selectExport(id: string | null) {
		currentExportId.set(id);
	}

	function toggleFilter(key: keyof FilterState, value: boolean | null) {
		filters.update(f => {
			const current = f[key];
			if (typeof current === 'boolean' || current === null) {
				return { ...f, [key]: current === true ? null : true };
			}
			return f;
		});
	}

	function setSortBy(sortBy: FilterState['sortBy']) {
		filters.update(f => ({ ...f, sortBy }));
	}

	function getEmailDomain(email: string): string {
		const match = email.match(/@([^@]+)$/);
		return match ? match[1].split('.')[0] : '';
	}

	function promptDelete(exp: ExportRecord, event: MouseEvent) {
		event.stopPropagation();
		exportToDelete = exp;
	}

	async function confirmDelete() {
		if (!exportToDelete) return;
		const id = exportToDelete.id;
		exportToDelete = null;
		await deleteExport(id);
		removeExport(id);
	}

	function cancelDelete() {
		exportToDelete = null;
	}

	async function handleDownloadBackup() {
		if (isBackingUp) return;
		isBackingUp = true;
		backupError = null;
		try {
			await saveBackup();
		} catch (e) {
			backupError = e instanceof Error ? e.message : 'Backup failed.';
		} finally {
			isBackingUp = false;
		}
	}

	function openRestorePicker() {
		backupError = null;
		fileInput?.click();
	}

	async function handleFileSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // allow re-picking the same file later
		if (!file) return;
		try {
			const { matches, databaseName, rowCount } = await inspectBackup(file);
			if (!matches) {
				backupError = `That file is a backup of "${databaseName}", not this app.`;
				return;
			}
			restoreCandidate = { file, rowCount };
		} catch {
			backupError = "That doesn't look like a valid backup file.";
		}
	}

	async function confirmRestore() {
		if (!restoreCandidate) return;
		const { file } = restoreCandidate;
		restoreCandidate = null;
		isRestoring = true;
		backupError = null;
		try {
			await restoreBackup(file);
			await initializeStores();
			resetFilters();
		} catch (e) {
			backupError = e instanceof Error ? e.message : 'Restore failed.';
		} finally {
			isRestoring = false;
		}
	}

	function cancelRestore() {
		restoreCandidate = null;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (restoreCandidate) cancelRestore();
		else if (exportToDelete) cancelDelete();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<aside class="sidebar" class:collapsed={isCollapsed}>
	<button class="toggle-btn" onclick={toggleSidebar} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			{#if isCollapsed}
				<polyline points="9,18 15,12 9,6" stroke-linecap="round" stroke-linejoin="round"/>
			{:else}
				<polyline points="15,18 9,12 15,6" stroke-linecap="round" stroke-linejoin="round"/>
			{/if}
		</svg>
	</button>

	{#if !isCollapsed}
		<div class="sidebar-content">
			<!-- Export Selector -->
			<section class="sidebar-section">
				<h3 class="section-title">Exports</h3>
				<div class="export-list">
					<button
						class="export-item"
						class:active={selectedExportId === null}
						onclick={() => selectExport(null)}
					>
						<div class="export-icon all">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
						<span class="export-name">All Exports</span>
						<span class="export-count">{allExports.reduce((sum, e) => sum + e.conversationCount, 0)}</span>
					</button>

					{#each allExports as exp (exp.id)}
						<div class="export-item-wrapper">
							<button
								class="export-item"
								class:active={selectedExportId === exp.id}
								onclick={() => selectExport(exp.id)}
							>
								<div class="export-avatar">
									{exp.user.full_name.charAt(0).toUpperCase()}
								</div>
								<div class="export-info">
									<span class="export-name">{exp.user.full_name}</span>
									<span class="export-domain">@{getEmailDomain(exp.user.email_address)}</span>
								</div>
								<span class="export-count">{exp.conversationCount}</span>
							</button>
							<button
								class="delete-btn"
								title="Remove export"
								onclick={(e) => promptDelete(exp, e)}
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="3 6 5 6 21 6" stroke-linecap="round" stroke-linejoin="round"/>
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</button>
						</div>
					{/each}
				</div>
			</section>

			<!-- Filters -->
			<section class="sidebar-section">
				<h3 class="section-title">Filters</h3>

				<div class="filter-group">
					<button
						class="filter-toggle"
						class:active={currentFilters.hasAttachments === true}
						onclick={() => toggleFilter('hasAttachments', null)}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						Attachments
					</button>

					<button
						class="filter-toggle"
						class:active={currentFilters.hasArtifacts === true}
						onclick={() => toggleFilter('hasArtifacts', null)}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
							<line x1="3" y1="9" x2="21" y2="9" stroke-linecap="round"/>
							<line x1="9" y1="21" x2="9" y2="9" stroke-linecap="round"/>
						</svg>
						Artifacts
					</button>

					<button
						class="filter-toggle"
						class:active={currentFilters.hasCode === true}
						onclick={() => toggleFilter('hasCode', null)}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="16,18 22,12 16,6" stroke-linecap="round" stroke-linejoin="round"/>
							<polyline points="8,6 2,12 8,18" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						Code
					</button>
				</div>

				<div class="filter-group checkboxes">
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={currentFilters.showEmpty}
							onchange={() => filters.update(f => ({ ...f, showEmpty: !f.showEmpty }))}
						/>
						<span class="checkbox-text">Show empty</span>
					</label>

					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={currentFilters.showHidden}
							onchange={() => filters.update(f => ({ ...f, showHidden: !f.showHidden }))}
						/>
						<span class="checkbox-text">Show hidden</span>
					</label>
				</div>
			</section>

			<!-- Sort -->
			<section class="sidebar-section">
				<h3 class="section-title">Sort by</h3>
				<div class="sort-options">
					<button
						class="sort-option"
						class:active={currentFilters.sortBy === 'date-desc'}
						onclick={() => setSortBy('date-desc')}
					>
						Newest
					</button>
					<button
						class="sort-option"
						class:active={currentFilters.sortBy === 'date-asc'}
						onclick={() => setSortBy('date-asc')}
					>
						Oldest
					</button>
					<button
						class="sort-option"
						class:active={currentFilters.sortBy === 'messages'}
						onclick={() => setSortBy('messages')}
					>
						Most messages
					</button>
					<button
						class="sort-option"
						class:active={currentFilters.sortBy === 'name'}
						onclick={() => setSortBy('name')}
					>
						Name
					</button>
				</div>
			</section>

			<!-- Backup / Restore -->
			<section class="sidebar-section data-section">
				<h3 class="section-title">Data</h3>
				<div class="filter-group">
					<button class="data-btn" onclick={handleDownloadBackup} disabled={isBackingUp || isRestoring}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round"/>
							<polyline points="7 10 12 15 17 10" stroke-linecap="round" stroke-linejoin="round"/>
							<line x1="12" y1="15" x2="12" y2="3" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						{isBackingUp ? 'Preparing…' : 'Download backup'}
					</button>
					<button class="data-btn" onclick={openRestorePicker} disabled={isBackingUp || isRestoring}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round"/>
							<polyline points="17 8 12 3 7 8" stroke-linecap="round" stroke-linejoin="round"/>
							<line x1="12" y1="3" x2="12" y2="15" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						{isRestoring ? 'Restoring…' : 'Restore backup'}
					</button>
				</div>
				{#if backupError}
					<p class="data-error">{backupError}</p>
				{/if}
				<input
					type="file"
					accept=".json,application/json"
					bind:this={fileInput}
					onchange={handleFileSelected}
					hidden
				/>
			</section>

			<!-- Reset -->
			<button class="reset-btn" onclick={resetFilters}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke-linecap="round" stroke-linejoin="round"/>
					<path d="M3 3v5h5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				Reset filters
			</button>
		</div>
	{/if}
</aside>

{#if exportToDelete}
	<div class="modal-backdrop">
		<button class="modal-scrim" aria-label="Cancel" onclick={cancelDelete}></button>
		<div class="modal" role="dialog" aria-modal="true">
			<div class="modal-icon">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="3 6 5 6 21 6" stroke-linecap="round" stroke-linejoin="round"/>
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"/>
					<line x1="10" y1="11" x2="10" y2="17" stroke-linecap="round" stroke-linejoin="round"/>
					<line x1="14" y1="11" x2="14" y2="17" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</div>
			<h3 class="modal-title">Remove export?</h3>
			<p class="modal-text">
				This will permanently delete the export for <strong>{exportToDelete.user.full_name}</strong>, including:
			</p>
			<div class="modal-stats">
				<div class="stat">
					<span class="stat-value">{exportToDelete.conversationCount}</span>
					<span class="stat-label">conversation{exportToDelete.conversationCount === 1 ? '' : 's'}</span>
				</div>
				<div class="stat">
					<span class="stat-value">{exportToDelete.messageCount}</span>
					<span class="stat-label">message{exportToDelete.messageCount === 1 ? '' : 's'}</span>
				</div>
			</div>
			<div class="modal-actions">
				<button class="modal-btn secondary" onclick={cancelDelete}>Cancel</button>
				<button class="modal-btn danger" onclick={confirmDelete}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="3 6 5 6 21 6" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					Remove
				</button>
			</div>
		</div>
	</div>
{/if}

{#if restoreCandidate}
	<div class="modal-backdrop">
		<button class="modal-scrim" aria-label="Cancel" onclick={cancelRestore}></button>
		<div class="modal" role="dialog" aria-modal="true">
			<div class="modal-icon warn">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round"/>
					<polyline points="17 8 12 3 7 8" stroke-linecap="round" stroke-linejoin="round"/>
					<line x1="12" y1="3" x2="12" y2="15" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</div>
			<h3 class="modal-title">Restore from backup?</h3>
			<p class="modal-text">
				This will <strong>replace all current data</strong> with the backup
				({restoreCandidate.rowCount.toLocaleString()} records). Any exports, edits,
				and fetched images not in the backup will be lost.
			</p>
			<div class="modal-actions">
				<button class="modal-btn secondary" onclick={cancelRestore}>Cancel</button>
				<button class="modal-btn warn" onclick={confirmRestore}>Restore</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: var(--cdv-sidebar-width);
		background-color: var(--cdv-color-surface-primary);
		border-right: 1px solid var(--cdv-color-border-subtle);
		z-index: var(--cdv-z-sticky);
		transition: width var(--cdv-transition-slow) var(--cdv-ease-default);
		overflow: hidden;
	}

	.sidebar.collapsed {
		width: 0;
		border-right: none;
	}

	.toggle-btn {
		position: absolute;
		top: var(--cdv-space-4);
		right: calc(-1 * var(--cdv-space-10));
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background-color: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-md);
		color: var(--cdv-color-text-tertiary);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
		z-index: 10;
		box-shadow: var(--cdv-shadow-sm);
	}

	.sidebar.collapsed .toggle-btn {
		right: calc(-1 * var(--cdv-space-12));
	}

	.toggle-btn:hover {
		color: var(--cdv-color-text-primary);
		border-color: var(--cdv-color-border-default);
		background-color: var(--cdv-color-bg-hover);
	}

	.sidebar-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--cdv-space-5);
		padding-top: var(--cdv-space-6);
		overflow-y: auto;
		gap: var(--cdv-space-6);
	}

	.sidebar-section {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-2);
	}

	.section-title {
		font-size: var(--cdv-font-size-xs);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: var(--cdv-letter-spacing-wider);
		margin: 0;
		padding: 0 var(--cdv-space-2);
	}

	.export-list {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-1);
	}

	.export-item-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}


	.delete-btn {
		position: absolute;
		right: var(--cdv-space-2);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background-color: transparent;
		border: none;
		border-radius: var(--cdv-radius-md);
		color: var(--cdv-color-text-disabled);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
		z-index: 1;
	}

	.delete-btn:hover {
		color: var(--cdv-color-error-500);
		background-color: var(--cdv-color-error-50);
	}

	:global(.dark) .delete-btn:hover {
		background-color: rgba(239, 68, 68, 0.15);
	}

	.export-item {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		padding: var(--cdv-space-2) var(--cdv-space-2);
		background-color: transparent;
		border: none;
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.export-item-wrapper .export-item {
		padding-right: var(--cdv-space-10);
	}

	.export-item:hover {
		background-color: var(--cdv-color-bg-hover);
	}

	.export-item.active {
		background-color: var(--cdv-color-brand-100);
	}

	:global(.dark) .export-item.active {
		background-color: var(--cdv-color-brand-900);
	}

	.export-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--cdv-radius-md);
		background-color: var(--cdv-color-bg-muted);
		color: var(--cdv-color-text-tertiary);
		flex-shrink: 0;
	}

	.export-item.active .export-icon {
		background-color: var(--cdv-color-brand-200);
		color: var(--cdv-color-brand-700);
	}

	:global(.dark) .export-item.active .export-icon {
		background-color: var(--cdv-color-brand-800);
		color: var(--cdv-color-brand-300);
	}

	.export-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--cdv-radius-full);
		background-color: var(--cdv-color-brand-100);
		color: var(--cdv-color-brand-700);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-semibold);
		flex-shrink: 0;
	}

	.export-item.active .export-avatar {
		background-color: var(--cdv-color-brand-500);
		color: white;
	}

	:global(.dark) .export-item.active .export-avatar {
		background-color: var(--cdv-color-brand-400);
	}

	.export-info {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-0-5);
		min-width: 0;
		flex: 1;
	}

	.export-name {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.export-domain {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}

	.export-count {
		font-size: var(--cdv-font-size-xs);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-tertiary);
		background-color: var(--cdv-color-bg-muted);
		padding: var(--cdv-space-0-5) var(--cdv-space-2);
		border-radius: var(--cdv-radius-full);
		flex-shrink: 0;
	}

	.export-item.active .export-count {
		background-color: var(--cdv-color-brand-200);
		color: var(--cdv-color-brand-700);
	}

	:global(.dark) .export-item.active .export-count {
		background-color: var(--cdv-color-brand-800);
		color: var(--cdv-color-brand-300);
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-1);
	}

	.filter-group.checkboxes {
		margin-top: var(--cdv-space-2);
		padding-top: var(--cdv-space-2);
		border-top: 1px solid var(--cdv-color-border-subtle);
	}

	.filter-toggle {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		background-color: transparent;
		border: 1px solid transparent;
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		width: 100%;
		text-align: left;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.filter-toggle:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}

	.filter-toggle.active {
		background-color: var(--cdv-color-brand-50);
		color: var(--cdv-color-brand-700);
		border-color: var(--cdv-color-brand-200);
	}

	.filter-toggle.active svg {
		color: var(--cdv-color-brand-500);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-1-5) var(--cdv-space-3);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		cursor: pointer;
		border-radius: var(--cdv-radius-md);
		transition: color var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.checkbox-label:hover {
		color: var(--cdv-color-text-primary);
	}

	.checkbox-label input {
		width: 16px;
		height: 16px;
		accent-color: var(--cdv-color-brand-500);
		cursor: pointer;
	}

	.checkbox-text {
		flex: 1;
	}

	.sort-options {
		display: flex;
		flex-wrap: wrap;
		gap: var(--cdv-space-1);
	}

	.sort-option {
		padding: var(--cdv-space-1-5) var(--cdv-space-3);
		font-size: var(--cdv-font-size-xs);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-secondary);
		background-color: var(--cdv-color-bg-muted);
		border: 1px solid transparent;
		border-radius: var(--cdv-radius-full);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.sort-option:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}

	.sort-option.active {
		background-color: var(--cdv-color-brand-500);
		color: white;
	}

	.data-section {
		margin-top: auto;
		padding-top: var(--cdv-space-4);
		border-top: 1px solid var(--cdv-color-border-subtle);
	}

	.data-btn {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		background-color: transparent;
		border: 1px solid transparent;
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		width: 100%;
		text-align: left;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.data-btn:hover:not(:disabled) {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
	}

	.data-btn:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.data-error {
		margin: var(--cdv-space-2) 0 0;
		padding: 0 var(--cdv-space-2);
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-error-500);
		line-height: var(--cdv-line-height-relaxed);
	}

	.reset-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2-5) var(--cdv-space-4);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-secondary);
		background-color: transparent;
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.reset-btn:hover {
		color: var(--cdv-color-text-primary);
		border-color: var(--cdv-color-border-default);
		background-color: var(--cdv-color-bg-hover);
	}

	/* Modal styles */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--cdv-z-modal);
		animation: fadeIn var(--cdv-transition-fast) var(--cdv-ease-out);
	}

	.modal-scrim {
		position: absolute;
		inset: 0;
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		cursor: default;
	}

	.modal {
		position: relative;
		z-index: 1;
		background-color: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-2xl);
		padding: var(--cdv-space-6);
		max-width: 380px;
		width: 90%;
		box-shadow: var(--cdv-shadow-xl);
		animation: scaleIn var(--cdv-transition-slow) var(--cdv-ease-out);
		text-align: center;
	}

	.modal-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		margin: 0 auto var(--cdv-space-4);
		background-color: var(--cdv-color-error-50);
		border-radius: var(--cdv-radius-full);
		color: var(--cdv-color-error-500);
	}

	.modal-icon.warn {
		background-color: var(--cdv-color-brand-100);
		color: var(--cdv-color-brand-600);
	}

	:global(.dark) .modal-icon.warn {
		background-color: var(--cdv-color-brand-900);
		color: var(--cdv-color-brand-300);
	}

	.modal-title {
		margin: 0 0 var(--cdv-space-2) 0;
		font-size: var(--cdv-font-size-xl);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-primary);
	}

	.modal-text {
		margin: 0 0 var(--cdv-space-4) 0;
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
		line-height: var(--cdv-line-height-relaxed);
	}

	.modal-text strong {
		color: var(--cdv-color-text-primary);
		font-weight: var(--cdv-font-weight-semibold);
	}

	.modal-stats {
		display: flex;
		justify-content: center;
		gap: var(--cdv-space-6);
		margin-bottom: var(--cdv-space-6);
		padding: var(--cdv-space-4);
		background-color: var(--cdv-color-bg-muted);
		border-radius: var(--cdv-radius-lg);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--cdv-space-0-5);
	}

	.stat-value {
		font-size: var(--cdv-font-size-2xl);
		font-weight: var(--cdv-font-weight-bold);
		color: var(--cdv-color-text-primary);
	}

	.stat-label {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}

	.modal-actions {
		display: flex;
		gap: var(--cdv-space-3);
	}

	.modal-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2-5) var(--cdv-space-4);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		border-radius: var(--cdv-radius-lg);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.modal-btn.secondary {
		background-color: transparent;
		border: 1px solid var(--cdv-color-border-default);
		color: var(--cdv-color-text-secondary);
	}

	.modal-btn.secondary:hover {
		background-color: var(--cdv-color-bg-hover);
		color: var(--cdv-color-text-primary);
		border-color: var(--cdv-color-border-strong);
	}

	.modal-btn.danger {
		background-color: var(--cdv-color-error-500);
		border: 1px solid var(--cdv-color-error-500);
		color: white;
	}

	.modal-btn.danger:hover {
		background-color: var(--cdv-color-error-600);
		border-color: var(--cdv-color-error-600);
	}

	.modal-btn.warn {
		background-color: var(--cdv-color-brand-500);
		border: 1px solid var(--cdv-color-brand-500);
		color: white;
	}

	.modal-btn.warn:hover {
		background-color: var(--cdv-color-brand-600);
		border-color: var(--cdv-color-brand-600);
	}

	@media (max-width: 768px) {
		.sidebar {
			display: none;
		}
	}
</style>
