<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import { exports, currentExportId, sidebarCollapsed } from '$lib/stores/app';
	import Header from '$lib/components/layout/Header.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import type { StoredConversation, StoredMessage } from '$lib/types';
	import Chart from 'chart.js/auto';

	let isLoading = $state(true);

	let totalExports = $state(0);
	let totalConversations = $state(0);
	let totalMessages = $state(0);
	let totalProjects = $state(0);

	let humanMessages = $state(0);
	let assistantMessages = $state(0);

	let convsWithAttachments = $state(0);
	let convsWithArtifacts = $state(0);
	let convsWithCode = $state(0);
	let convsWithThinking = $state(0);

	let messagesByMonth = $state<{ month: string; count: number }[]>([]);

	let topConversations = $state<{ name: string; messageCount: number; uuid: string }[]>([]);

	let avgMessagesPerConv = $state(0);

	let timelineChart: Chart | null = null;
	let senderChart: Chart | null = null;
	let featuresChart: Chart | null = null;

	let timelineCanvas = $state<HTMLCanvasElement>();
	let senderCanvas = $state<HTMLCanvasElement>();
	let featuresCanvas = $state<HTMLCanvasElement>();

	async function loadStats() {
		isLoading = true;

		try {
			const exportId = $currentExportId;

			const allExports = await db.exports.toArray();
			totalExports = allExports.length;
			totalProjects = allExports.reduce((sum, e) => sum + e.projects.length, 0);

			let conversations: StoredConversation[];
			if (exportId) {
				conversations = await db.conversations.where('exportId').equals(exportId).toArray();
			} else {
				conversations = await db.conversations.toArray();
			}
			totalConversations = conversations.length;

			let messages: StoredMessage[];
			if (exportId) {
				messages = await db.messages.where('exportId').equals(exportId).toArray();
			} else {
				messages = await db.messages.toArray();
			}
			totalMessages = messages.length;

			humanMessages = messages.filter(m => m.sender === 'human').length;
			assistantMessages = messages.filter(m => m.sender === 'assistant').length;

			convsWithAttachments = conversations.filter(c => c.hasAttachments).length;
			convsWithArtifacts = conversations.filter(c => c.hasArtifacts).length;
			convsWithCode = conversations.filter(c => c.hasCode).length;
			convsWithThinking = conversations.filter(c => c.hasThinking).length;

			avgMessagesPerConv = totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0;

			topConversations = [...conversations]
				.sort((a, b) => b.messageCount - a.messageCount)
				.slice(0, 10)
				.map(c => ({ name: c.name || 'Untitled', messageCount: c.messageCount, uuid: c.uuid }));

			const monthCounts = new Map<string, number>();
			for (const msg of messages) {
				const date = new Date(msg.createdAt);
				const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
				monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
			}

			messagesByMonth = Array.from(monthCounts.entries())
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([month, count]) => ({ month, count }));

		} catch (error) {
			console.error('Failed to load stats:', error);
		} finally {
			isLoading = false;
		}
	}

	function formatMonth(monthKey: string): string {
		const [year, month] = monthKey.split('-');
		const date = new Date(parseInt(year), parseInt(month) - 1);
		return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
	}

	function createCharts() {
		timelineChart?.destroy();
		senderChart?.destroy();
		featuresChart?.destroy();

		if (!timelineCanvas || !senderCanvas || !featuresCanvas) return;

		const chartColors = {
			brand: 'rgb(217, 119, 87)',
			brandLight: 'rgba(217, 119, 87, 0.2)',
			accent: 'rgb(245, 158, 11)',
			accentLight: 'rgba(245, 158, 11, 0.2)',
			gray: 'rgb(120, 113, 108)',
			grayLight: 'rgba(120, 113, 108, 0.2)',
			success: 'rgb(34, 197, 94)',
			info: 'rgb(59, 130, 246)',
		};

		if (messagesByMonth.length > 0) {
			timelineChart = new Chart(timelineCanvas, {
				type: 'bar',
				data: {
					labels: messagesByMonth.map(d => formatMonth(d.month)),
					datasets: [{
						label: 'Messages',
						data: messagesByMonth.map(d => d.count),
						backgroundColor: chartColors.brandLight,
						borderColor: chartColors.brand,
						borderWidth: 2,
						borderRadius: 4,
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							backgroundColor: 'rgba(0, 0, 0, 0.8)',
							padding: 12,
							cornerRadius: 8,
						}
					},
					scales: {
						x: {
							grid: { display: false },
							ticks: { color: 'rgb(120, 113, 108)' }
						},
						y: {
							beginAtZero: true,
							grid: { color: 'rgba(120, 113, 108, 0.1)' },
							ticks: { color: 'rgb(120, 113, 108)' }
						}
					}
				}
			});
		}

		if (humanMessages > 0 || assistantMessages > 0) {
			senderChart = new Chart(senderCanvas, {
				type: 'doughnut',
				data: {
					labels: ['Human', 'Assistant'],
					datasets: [{
						data: [humanMessages, assistantMessages],
						backgroundColor: [chartColors.brand, chartColors.accent],
						borderWidth: 0,
						hoverOffset: 4
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: 'bottom',
							labels: { color: 'rgb(120, 113, 108)', padding: 16 }
						},
						tooltip: {
							backgroundColor: 'rgba(0, 0, 0, 0.8)',
							padding: 12,
							cornerRadius: 8,
						}
					},
					cutout: '60%'
				}
			});
		}

		const featureData = [
			{ label: 'Attachments', value: convsWithAttachments },
			{ label: 'Artifacts', value: convsWithArtifacts },
			{ label: 'Code', value: convsWithCode },
			{ label: 'Thinking', value: convsWithThinking },
		];

		if (featureData.some(d => d.value > 0)) {
			featuresChart = new Chart(featuresCanvas, {
				type: 'bar',
				data: {
					labels: featureData.map(d => d.label),
					datasets: [{
						label: 'Conversations',
						data: featureData.map(d => d.value),
						backgroundColor: [
							'rgba(217, 119, 87, 0.7)',
							'rgba(245, 158, 11, 0.7)',
							'rgba(59, 130, 246, 0.7)',
							'rgba(168, 85, 247, 0.7)',
						],
						borderRadius: 4,
					}]
				},
				options: {
					indexAxis: 'y',
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							backgroundColor: 'rgba(0, 0, 0, 0.8)',
							padding: 12,
							cornerRadius: 8,
						}
					},
					scales: {
						x: {
							beginAtZero: true,
							grid: { color: 'rgba(120, 113, 108, 0.1)' },
							ticks: { color: 'rgb(120, 113, 108)' }
						},
						y: {
							grid: { display: false },
							ticks: { color: 'rgb(120, 113, 108)' }
						}
					}
				}
			});
		}
	}

	onMount(() => {
		loadStats();
	});

	$effect(() => {
		if ($currentExportId !== undefined) {
			loadStats();
		}
	});

	$effect(() => {
		if (!isLoading && messagesByMonth.length >= 0) {
			// Small delay to ensure canvas is rendered
			setTimeout(createCharts, 100);
		}
	});
</script>

<div class="page-container" class:sidebar-collapsed={$sidebarCollapsed}>
	<Sidebar />

	<div class="main-area">
		<Header />

		<div class="content">
			{#if isLoading}
				<div class="loading-state">
					<div class="loading-spinner"></div>
					<p>Loading statistics...</p>
				</div>
			{:else}
				<!-- Overview Cards -->
				<div class="stats-grid">
					<div class="stat-card">
						<div class="stat-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
						<div class="stat-info">
							<span class="stat-value">{totalConversations.toLocaleString()}</span>
							<span class="stat-label">Conversations</span>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
						<div class="stat-info">
							<span class="stat-value">{totalMessages.toLocaleString()}</span>
							<span class="stat-label">Messages</span>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
						<div class="stat-info">
							<span class="stat-value">{totalProjects.toLocaleString()}</span>
							<span class="stat-label">Projects</span>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
								<polyline points="14,2 14,8 20,8" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
						<div class="stat-info">
							<span class="stat-value">{totalExports.toLocaleString()}</span>
							<span class="stat-label">Exports</span>
						</div>
					</div>
				</div>

				<!-- Charts Row -->
				<div class="charts-row">
					<!-- Timeline Chart -->
					<div class="chart-card wide">
						<h3 class="chart-title">Messages Over Time</h3>
						{#if messagesByMonth.length > 0}
							<div class="chart-container">
								<canvas bind:this={timelineCanvas}></canvas>
							</div>
						{:else}
							<div class="chart-empty">No timeline data available</div>
						{/if}
					</div>
				</div>

				<div class="charts-row">
					<!-- Sender Distribution -->
					<div class="chart-card">
						<h3 class="chart-title">Message Senders</h3>
						{#if humanMessages > 0 || assistantMessages > 0}
							<div class="chart-container doughnut">
								<canvas bind:this={senderCanvas}></canvas>
							</div>
							<div class="chart-stats">
								<div class="chart-stat">
									<span class="dot human"></span>
									<span>Human: {humanMessages.toLocaleString()}</span>
								</div>
								<div class="chart-stat">
									<span class="dot assistant"></span>
									<span>Assistant: {assistantMessages.toLocaleString()}</span>
								</div>
							</div>
						{:else}
							<div class="chart-empty">No message data available</div>
						{/if}
					</div>

					<!-- Features Chart -->
					<div class="chart-card">
						<h3 class="chart-title">Conversations by Feature</h3>
						{#if totalConversations > 0}
							<div class="chart-container">
								<canvas bind:this={featuresCanvas}></canvas>
							</div>
						{:else}
							<div class="chart-empty">No feature data available</div>
						{/if}
					</div>
				</div>

				<!-- Additional Stats -->
				<div class="charts-row">
					<!-- Quick Stats -->
					<div class="chart-card">
						<h3 class="chart-title">Quick Stats</h3>
						<div class="quick-stats">
							<div class="quick-stat">
								<span class="quick-stat-value">{avgMessagesPerConv}</span>
								<span class="quick-stat-label">Avg messages per conversation</span>
							</div>
							<div class="quick-stat">
								<span class="quick-stat-value">{((convsWithThinking / totalConversations) * 100 || 0).toFixed(1)}%</span>
								<span class="quick-stat-label">Conversations with thinking</span>
							</div>
							<div class="quick-stat">
								<span class="quick-stat-value">{((convsWithArtifacts / totalConversations) * 100 || 0).toFixed(1)}%</span>
								<span class="quick-stat-label">Conversations with artifacts</span>
							</div>
						</div>
					</div>

					<!-- Top Conversations -->
					<div class="chart-card">
						<h3 class="chart-title">Top Conversations</h3>
						{#if topConversations.length > 0}
							<div class="top-list">
								{#each topConversations as conv, i}
									<a href="/conversations/{conv.uuid}" class="top-item">
										<span class="top-rank">#{i + 1}</span>
										<span class="top-name">{conv.name}</span>
										<span class="top-count">{conv.messageCount} msgs</span>
									</a>
								{/each}
							</div>
						{:else}
							<div class="chart-empty">No conversations yet</div>
						{/if}
					</div>
				</div>
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
		max-width: 1400px;
		width: 100%;
		margin: 0 auto;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--cdv-space-4);
		padding: var(--cdv-space-16);
		color: var(--cdv-color-text-secondary);
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

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--cdv-space-4);
		margin-bottom: var(--cdv-space-6);
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-4);
		padding: var(--cdv-space-5);
		background-color: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-xl);
		box-shadow: var(--cdv-shadow-sm);
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background-color: var(--cdv-color-brand-50);
		border-radius: var(--cdv-radius-lg);
		color: var(--cdv-color-brand-600);
		flex-shrink: 0;
	}

	:global(.dark) .stat-icon {
		background-color: var(--cdv-color-brand-900);
		color: var(--cdv-color-brand-400);
	}

	.stat-info {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-0-5);
	}

	.stat-value {
		font-size: var(--cdv-font-size-2xl);
		font-weight: var(--cdv-font-weight-bold);
		color: var(--cdv-color-text-primary);
		line-height: 1;
	}

	.stat-label {
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-tertiary);
	}

	/* Charts */
	.charts-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--cdv-space-4);
		margin-bottom: var(--cdv-space-4);
	}

	.chart-card {
		padding: var(--cdv-space-5);
		background-color: var(--cdv-color-surface-primary);
		border: 1px solid var(--cdv-color-border-subtle);
		border-radius: var(--cdv-radius-xl);
		box-shadow: var(--cdv-shadow-sm);
	}

	.chart-card.wide {
		grid-column: span 2;
	}

	.chart-title {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 var(--cdv-space-4) 0;
	}

	.chart-container {
		height: 250px;
		position: relative;
	}

	.chart-container.doughnut {
		height: 200px;
	}

	.chart-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: var(--cdv-color-text-tertiary);
		font-size: var(--cdv-font-size-sm);
	}

	.chart-stats {
		display: flex;
		justify-content: center;
		gap: var(--cdv-space-6);
		margin-top: var(--cdv-space-4);
	}

	.chart-stat {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-2);
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-secondary);
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.dot.human {
		background-color: rgb(217, 119, 87);
	}

	.dot.assistant {
		background-color: rgb(245, 158, 11);
	}

	/* Quick Stats */
	.quick-stats {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-4);
	}

	.quick-stat {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-1);
		padding: var(--cdv-space-3);
		background-color: var(--cdv-color-bg-raised);
		border-radius: var(--cdv-radius-lg);
	}

	.quick-stat-value {
		font-size: var(--cdv-font-size-xl);
		font-weight: var(--cdv-font-weight-bold);
		color: var(--cdv-color-text-primary);
	}

	.quick-stat-label {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
	}

	/* Top Conversations */
	.top-list {
		display: flex;
		flex-direction: column;
		gap: var(--cdv-space-1);
		max-height: 300px;
		overflow-y: auto;
	}

	.top-item {
		display: flex;
		align-items: center;
		gap: var(--cdv-space-3);
		padding: var(--cdv-space-2) var(--cdv-space-3);
		border-radius: var(--cdv-radius-md);
		text-decoration: none;
		transition: background-color var(--cdv-transition-fast) var(--cdv-ease-default);
	}

	.top-item:hover {
		background-color: var(--cdv-color-bg-hover);
	}

	.top-rank {
		font-size: var(--cdv-font-size-xs);
		font-weight: var(--cdv-font-weight-semibold);
		color: var(--cdv-color-text-tertiary);
		width: 24px;
	}

	.top-name {
		flex: 1;
		font-size: var(--cdv-font-size-sm);
		color: var(--cdv-color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.top-count {
		font-size: var(--cdv-font-size-xs);
		color: var(--cdv-color-text-tertiary);
		white-space: nowrap;
	}

	@media (max-width: 1024px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.charts-row {
			grid-template-columns: 1fr;
		}

		.chart-card.wide {
			grid-column: span 1;
		}
	}

	@media (max-width: 768px) {
		.main-area {
			margin-left: 0;
		}

		.content {
			padding: var(--cdv-space-4);
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}

		.stat-card {
			padding: var(--cdv-space-4);
		}
	}
</style>
