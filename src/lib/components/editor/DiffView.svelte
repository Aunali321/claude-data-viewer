<script lang="ts">
	interface Props {
		original: string;
		current: string;
	}
	
	let { original, current }: Props = $props();
	
	// Simple line-by-line diff
	function computeDiff(): Array<{ type: 'same' | 'added' | 'removed'; text: string }> {
		const originalLines = original.split('\n');
		const currentLines = current.split('\n');
		const result: Array<{ type: 'same' | 'added' | 'removed'; text: string }> = [];
		
		// Use longest common subsequence for better diff
		const lcs = getLCS(originalLines, currentLines);
		let origIdx = 0;
		let currIdx = 0;
		let lcsIdx = 0;
		
		while (origIdx < originalLines.length || currIdx < currentLines.length) {
			if (lcsIdx < lcs.length && origIdx < originalLines.length && originalLines[origIdx] === lcs[lcsIdx]) {
				// Lines before current LCS element that are only in original = removed
				while (currIdx < currentLines.length && currentLines[currIdx] !== lcs[lcsIdx]) {
					result.push({ type: 'added', text: currentLines[currIdx] });
					currIdx++;
				}
				// This line is in both
				result.push({ type: 'same', text: originalLines[origIdx] });
				origIdx++;
				currIdx++;
				lcsIdx++;
			} else if (origIdx < originalLines.length) {
				// Line only in original = removed
				result.push({ type: 'removed', text: originalLines[origIdx] });
				origIdx++;
			} else if (currIdx < currentLines.length) {
				// Line only in current = added
				result.push({ type: 'added', text: currentLines[currIdx] });
				currIdx++;
			}
		}
		
		return result;
	}
	
	function getLCS(a: string[], b: string[]): string[] {
		const m = a.length;
		const n = b.length;
		const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
		
		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				if (a[i - 1] === b[j - 1]) {
					dp[i][j] = dp[i - 1][j - 1] + 1;
				} else {
					dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
				}
			}
		}
		
		// Backtrack to find LCS
		const lcs: string[] = [];
		let i = m, j = n;
		while (i > 0 && j > 0) {
			if (a[i - 1] === b[j - 1]) {
				lcs.unshift(a[i - 1]);
				i--;
				j--;
			} else if (dp[i - 1][j] > dp[i][j - 1]) {
				i--;
			} else {
				j--;
			}
		}
		
		return lcs;
	}
	
	let diffLines = $derived(computeDiff());
	let addedCount = $derived(diffLines.filter(d => d.type === 'added').length);
	let removedCount = $derived(diffLines.filter(d => d.type === 'removed').length);
</script>

<div class="diff-view">
	<div class="diff-header">
		<span class="diff-title">Changes</span>
		<div class="diff-stats">
			{#if addedCount > 0}
				<span class="stat added">+{addedCount}</span>
			{/if}
			{#if removedCount > 0}
				<span class="stat removed">-{removedCount}</span>
			{/if}
		</div>
	</div>
	
	<div class="diff-content">
		{#each diffLines as line, index}
			<div class="diff-line" class:added={line.type === 'added'} class:removed={line.type === 'removed'}>
				<span class="line-number">{index + 1}</span>
				<span class="line-marker">
					{#if line.type === 'added'}+{:else if line.type === 'removed'}-{:else}&nbsp;{/if}
				</span>
				<span class="line-text">{line.text || ' '}</span>
			</div>
		{/each}
		
		{#if diffLines.length === 0}
			<div class="no-changes">No changes</div>
		{/if}
	</div>
</div>

<style>
	.diff-view {
		display: flex;
		flex-direction: column;
		max-height: 400px;
		overflow: hidden;
	}
	
	.diff-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--cdv-space-3) var(--cdv-space-4);
		background-color: var(--cdv-color-bg-elevated);
		border-bottom: 1px solid var(--cdv-color-border-subtle);
	}
	
	.diff-title {
		font-size: var(--cdv-font-size-sm);
		font-weight: var(--cdv-font-weight-medium);
		color: var(--cdv-color-text-secondary);
	}
	
	.diff-stats {
		display: flex;
		gap: var(--cdv-space-2);
		font-size: var(--cdv-font-size-sm);
		font-family: var(--cdv-font-mono);
	}
	
	.stat.added {
		color: var(--cdv-color-success-500);
	}
	
	.stat.removed {
		color: var(--cdv-color-error-500);
	}
	
	.diff-content {
		flex: 1;
		overflow-y: auto;
		background-color: var(--cdv-color-bg-base);
		font-family: var(--cdv-font-mono);
		font-size: var(--cdv-font-size-sm);
		line-height: var(--cdv-line-height-relaxed);
	}
	
	.diff-line {
		display: flex;
		padding: var(--cdv-space-0-5) var(--cdv-space-2);
		border-left: 3px solid transparent;
	}
	
	.diff-line.added {
		background-color: rgba(34, 197, 94, 0.1);
		border-left-color: var(--cdv-color-success-500);
	}
	
	.diff-line.removed {
		background-color: rgba(239, 68, 68, 0.1);
		border-left-color: var(--cdv-color-error-500);
		text-decoration: line-through;
		opacity: 0.8;
	}
	
	.line-number {
		width: 40px;
		flex-shrink: 0;
		text-align: right;
		padding-right: var(--cdv-space-2);
		color: var(--cdv-color-text-tertiary);
		user-select: none;
	}
	
	.line-marker {
		width: 20px;
		flex-shrink: 0;
		text-align: center;
		font-weight: var(--cdv-font-weight-bold);
	}
	
	.diff-line.added .line-marker {
		color: var(--cdv-color-success-500);
	}
	
	.diff-line.removed .line-marker {
		color: var(--cdv-color-error-500);
	}
	
	.line-text {
		flex: 1;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--cdv-color-text-primary);
	}
	
	.no-changes {
		padding: var(--cdv-space-8);
		text-align: center;
		color: var(--cdv-color-text-tertiary);
	}
</style>
