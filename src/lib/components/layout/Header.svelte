<script lang="ts">
	import { theme } from '$lib/stores/theme';
	import { exports } from '$lib/stores/app';
	import { page } from '$app/stores';

	let currentTheme = $derived($theme);
	let hasData = $derived($exports.length > 0);
	let pathname = $derived($page.url.pathname);

	function toggleTheme() {
		theme.toggle();
	}

	function isActive(path: string, exact: boolean = false): boolean {
		if (exact) {
			return pathname === path;
		}
		return pathname.startsWith(path);
	}
</script>

<header class="header">
	<a href="/" class="logo">
		<div class="logo-mark">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
				<path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.9"/>
				<path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</div>
		<span class="logo-text">Data Viewer</span>
	</a>

	{#if hasData}
		<nav class="nav">
			<a href="/conversations" class="nav-link" class:active={isActive('/conversations')}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>Conversations</span>
			</a>
			<a href="/projects" class="nav-link" class:active={isActive('/projects')}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>Projects</span>
			</a>
			<a href="/stats" class="nav-link" class:active={isActive('/stats', true)}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 20V10M12 20V4M6 20v-6" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>Stats</span>
			</a>
		</nav>
	{/if}

	<div class="header-end">
		<button
			class="theme-btn"
			onclick={toggleTheme}
			title={currentTheme === 'dark' ? 'Light mode' : 'Dark mode'}
		>
			{#if currentTheme === 'dark'}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="5"/>
					<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round"/>
				</svg>
			{:else}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			{/if}
		</button>
	</div>
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-6);
		padding: 0 var(--cdv-space-5);
		height: 52px;
		background: linear-gradient(to bottom, var(--cdv-color-surface-primary), var(--cdv-color-bg-base));
	}

	.logo {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		text-decoration: none;
		color: var(--cdv-color-text-primary);
		font-weight: var(--cdv-font-weight-semibold);
		font-size: var(--cdv-font-size-sm);
		letter-spacing: -0.01em;
	}

	.logo-mark {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: linear-gradient(135deg, var(--cdv-color-brand-500), var(--cdv-color-brand-600));
		border-radius: var(--cdv-radius-lg);
		color: white;
		box-shadow: 0 2px 8px rgba(217, 119, 87, 0.25);
	}

	.logo-text {
		color: var(--cdv-color-text-secondary);
	}

	.nav {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-1);
		margin-left: auto;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-tertiary);
		text-decoration: none;
		border-radius: var(--cdv-radius-lg);
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.nav-link:hover {
		color: var(--cdv-color-text-primary);
		background-color: var(--cdv-color-bg-hover);
	}

	.nav-link.active {
		color: var(--cdv-color-brand-600);
		background-color: var(--cdv-color-brand-50);
	}

	.nav-link svg {
		opacity: 0.7;
	}

	.nav-link.active svg {
		opacity: 1;
	}

	.header-end {
		display: flex;
		align-items: center;
		margin-left: auto;
	}

	.nav + .header-end {
		margin-left: 0;
	}

	.theme-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: transparent;
		border: none;
		border-radius: var(--cdv-radius-lg);
		color: var(--cdv-color-text-tertiary);
		cursor: pointer;
		transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.theme-btn:hover {
		color: var(--cdv-color-text-primary);
		background-color: var(--cdv-color-bg-hover);
	}

	@media (max-width: 768px) {
		.header {
			padding: 0 var(--cdv-space-3);
		}

		.logo-text {
			display: none;
		}

		.nav-link span {
			display: none;
		}

		.nav {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			margin: 0;
			padding: var(--cdv-space-2) var(--cdv-space-4);
			background-color: var(--cdv-color-surface-primary);
			border-top: 1px solid var(--cdv-color-border-subtle);
			justify-content: center;
			gap: var(--cdv-space-2);
			z-index: var(--cdv-z-sticky);
		}

		.nav-link {
			flex-direction: column;
			gap: var(--cdv-space-1);
			padding: var(--cdv-space-2);
			font-size: var(--cdv-font-size-xs);
		}

		.nav-link span {
			display: block;
		}
	}
</style>
