<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { theme } from '$lib/stores/theme';
	import { onMount } from 'svelte';
	import { initializeStores } from '$lib/stores/app';

	let { children } = $props();

	onMount(() => {
		// Initialize theme
		theme.init();
		
		// Initialize data stores
		initializeStores();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Claude Data Viewer</title>
	<meta name="description" content="View and export Claude.ai conversation data" />
</svelte:head>

<div class="app-container">
	{@render children()}
</div>

<style>
	.app-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
</style>
