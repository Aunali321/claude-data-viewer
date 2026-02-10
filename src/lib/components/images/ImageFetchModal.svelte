<script lang="ts">
    import {
        findConversationsWithImages,
        fetchAllImages,
        type FetchAllImagesProgress,
    } from "$lib/utils/images";
    import { updateExportOrgId } from "$lib/db";

    interface Props {
        exportId: string;
        exportName: string;
        onClose: () => void;
        onComplete?: () => void;
    }

    let { exportId, exportName, onClose, onComplete }: Props = $props();

    let organizationId = $state("");
    let cookieString = $state("");
    let conversationCount = $state(0);
    let isFetching = $state(false);
    let isComplete = $state(false);
    let progress = $state<FetchAllImagesProgress | null>(null);
    let error = $state("");

    $effect(() => {
        loadConversationCount();
    });

    async function loadConversationCount() {
        const conversations = await findConversationsWithImages(exportId);
        conversationCount = conversations.size;
    }

    async function handleFetch() {
        if (!organizationId.trim() || !cookieString.trim()) {
            error = "Please enter both Organization ID and Cookie String";
            return;
        }

        error = "";
        isFetching = true;

        await updateExportOrgId(exportId, organizationId.trim());

        try {
            const result = await fetchAllImages(
                exportId,
                organizationId.trim(),
                cookieString.trim(),
                (p) => {
                    progress = { ...p };
                },
            );

            isFetching = false;
            isComplete = true;

            if (result.succeededFiles > 0) {
                onComplete?.();
            }
        } catch (err) {
            isFetching = false;
            error = err instanceof Error ? err.message : "Failed to fetch images";
        }
    }

    function handleClose() {
        onClose();
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={handleClose}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
            <h2>Fetch Images</h2>
            <button class="close-btn" onclick={handleClose} aria-label="Close">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <line
                        x1="18"
                        y1="6"
                        x2="6"
                        y2="18"
                        stroke-linecap="round"
                    />
                    <line
                        x1="6"
                        y1="6"
                        x2="18"
                        y2="18"
                        stroke-linecap="round"
                    />
                </svg>
            </button>
        </div>

        <div class="modal-body">
            {#if isComplete}
                <div class="complete-section">
                    <div
                        class="complete-icon"
                        class:has-errors={progress && progress.failedFiles > 0}
                    >
                        {#if progress && progress.failedFiles === 0}
                            <svg
                                width="48"
                                height="48"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <polyline
                                    points="9,12 12,15 16,10"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        {:else}
                            <svg
                                width="48"
                                height="48"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line
                                    x1="12"
                                    y1="8"
                                    x2="12"
                                    y2="12"
                                    stroke-linecap="round"
                                />
                                <line
                                    x1="12"
                                    y1="16"
                                    x2="12.01"
                                    y2="16"
                                    stroke-linecap="round"
                                />
                            </svg>
                        {/if}
                    </div>
                    <h3>Fetch Complete</h3>
                    <p class="stats">
                        {progress?.succeededFiles || 0} succeeded, {progress?.failedFiles || 0} failed
                    </p>
                    {#if progress && (progress.fileErrors.length > 0 || progress.conversationErrors.length > 0)}
                        <div class="errors-list">
                            <p class="errors-title">Errors:</p>
                            {#each progress.conversationErrors.slice(0, 3) as err}
                                <div class="error-item">Conv {err.conversationUuid.slice(0, 8)}... - {err.error}</div>
                            {/each}
                            {#each progress.fileErrors.slice(0, 5) as err}
                                <div class="error-item">{err.fileUuid.slice(0, 8)}... - {err.error}</div>
                            {/each}
                            {#if progress.fileErrors.length + progress.conversationErrors.length > 8}
                                <div class="error-item">...and {progress.fileErrors.length + progress.conversationErrors.length - 8} more</div>
                            {/if}
                        </div>
                    {/if}
                    <button class="primary-btn" onclick={handleClose}
                        >Done</button
                    >
                </div>
            {:else if isFetching}
                <div class="fetching-section">
                    <div class="spinner"></div>
                    <h3>Fetching Images...</h3>
                    {#if progress}
                        <p class="progress-text">
                            Conversation {progress.completedConversations}/{progress.totalConversations}
                        </p>
                        <div class="progress-bar">
                            <div
                                class="progress-fill"
                                style="width: {progress.totalConversations > 0 ? (progress.completedConversations / progress.totalConversations) * 100 : 0}%"
                            ></div>
                        </div>
                        <p class="progress-text">
                            Files: {progress.succeededFiles + progress.failedFiles} / {progress.totalFiles}
                            ({progress.succeededFiles} succeeded, {progress.failedFiles} failed)
                        </p>
                    {/if}
                </div>
            {:else}
                <div class="info-section">
                    <div class="info-badge">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="2"
                                ry="2"
                            />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21,15 16,10 5,21" />
                        </svg>
                        <span
                            >{conversationCount} conversations with images in "{exportName}"</span
                        >
                    </div>

                    <p class="instructions">
                        Claude's data export includes image references but not
                        the actual images. To fetch them, you need to be logged
                        in to Claude and provide your credentials.
                    </p>
                    
                    <div class="rate-limit-note">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12" stroke-linecap="round"/>
                            <line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round"/>
                        </svg>
                        <span>Images are fetched with delays and automatic retries to handle rate limiting. Some images may fail due to Cloudflare protection.</span>
                    </div>

                    <div class="steps">
                        <div class="step">
                            <span class="step-num">1</span>
                            <div class="step-content">
                                <strong>Login to Claude</strong>
                                <p>
                                    Open <a
                                        href="https://claude.ai"
                                        target="_blank"
                                        rel="noopener">claude.ai</a
                                    > and ensure you're logged in.
                                </p>
                            </div>
                        </div>

                        <div class="step">
                            <span class="step-num">2</span>
                            <div class="step-content">
                                <strong>Get Organization ID</strong>
                                <p>
                                    Check DevTools → Application → Cookies →
                                    <code>lastActiveOrg</code>
                                </p>
                            </div>
                        </div>

                        <div class="step">
                            <span class="step-num">3</span>
                            <div class="step-content">
                                <strong>Copy All Cookies</strong>
                                <p>
                                    DevTools → Network tab → Click any request to claude.ai → Headers → Request Headers → Find "cookie:" → Copy the ENTIRE value (may be very long)
                                </p>
                                <p style="color: var(--cdv-color-warning-500); font-size: 11px; margin-top: 4px;">
                                    ⚠️ Do NOT copy from Application tab as it may truncate values with "..."
                                </p>
                            </div>
                        </div>
                    </div>

                    {#if error}
                        <div class="error-message">{error}</div>
                    {/if}

                    <div class="form-group">
                        <label for="orgId">Organization ID</label>
                        <input
                            id="orgId"
                            type="text"
                            bind:value={organizationId}
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                    </div>

                    <div class="form-group">
                        <label for="cookieString">Cookie String</label>
                        <textarea
                            id="cookieString"
                            bind:value={cookieString}
                            placeholder="Paste full cookie string here..."
                            rows="4"
                        ></textarea>
                        <p class="field-note">
                            Copy all cookies from DevTools. This is only used for this fetch and not stored permanently.
                        </p>
                    </div>
                </div>
            {/if}
        </div>

        {#if !isComplete && !isFetching}
            <div class="modal-footer">
                <button class="secondary-btn" onclick={handleClose}
                    >Cancel</button
                >
                <button
                    class="primary-btn"
                    onclick={handleFetch}
                    disabled={conversationCount === 0}
                >
                    Fetch Images from {conversationCount} Conversations
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
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
        max-width: 560px;
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
        padding: var(--cdv-space-4) var(--cdv-space-5);
        border-bottom: 1px solid var(--cdv-color-border-subtle);
    }

    .modal-header h2 {
        font-size: var(--cdv-font-size-lg);
        font-weight: var(--cdv-font-weight-semibold);
        color: var(--cdv-color-text-primary);
        margin: 0;
    }

    .close-btn {
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
    }

    .close-btn:hover {
        background-color: var(--cdv-color-bg-hover);
        color: var(--cdv-color-text-primary);
    }

    .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: var(--cdv-space-5);
    }

    .info-badge {
        display: flex;
        align-items: center;
        gap: var(--cdv-space-2);
        padding: var(--cdv-space-3);
        background-color: var(--cdv-color-info-muted);
        border-radius: var(--cdv-radius-lg);
        color: var(--cdv-color-info-500);
        font-weight: var(--cdv-font-weight-medium);
        margin-bottom: var(--cdv-space-4);
    }

    .instructions {
        color: var(--cdv-color-text-secondary);
        font-size: var(--cdv-font-size-sm);
        line-height: var(--cdv-line-height-relaxed);
        margin-bottom: var(--cdv-space-4);
    }

    .steps {
        display: flex;
        flex-direction: column;
        gap: var(--cdv-space-3);
        margin-bottom: var(--cdv-space-5);
    }

    .step {
        display: flex;
        gap: var(--cdv-space-3);
    }

    .step-num {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--cdv-color-accent-500);
        color: var(--cdv-color-bg-base);
        font-size: var(--cdv-font-size-xs);
        font-weight: var(--cdv-font-weight-bold);
        border-radius: 50%;
    }

    .step-content strong {
        display: block;
        color: var(--cdv-color-text-primary);
        font-size: var(--cdv-font-size-sm);
        margin-bottom: 2px;
    }

    .step-content p {
        color: var(--cdv-color-text-tertiary);
        font-size: var(--cdv-font-size-xs);
        margin: 0;
        line-height: var(--cdv-line-height-normal);
    }

    .step-content code {
        background-color: var(--cdv-color-bg-base);
        padding: 1px 4px;
        border-radius: var(--cdv-radius-sm);
        font-family: var(--cdv-font-mono);
        font-size: var(--cdv-font-size-xs);
    }

    .step-content a {
        color: var(--cdv-color-accent-400);
    }
    
    .rate-limit-note {
        display: flex;
        gap: var(--cdv-space-2);
        padding: var(--cdv-space-3);
        background-color: var(--cdv-color-info-muted);
        border: 1px solid var(--cdv-color-info-500);
        border-radius: var(--cdv-radius-md);
        color: var(--cdv-color-info-500);
        font-size: var(--cdv-font-size-xs);
        line-height: var(--cdv-line-height-normal);
        margin-bottom: var(--cdv-space-4);
    }
    
    .rate-limit-note svg {
        flex-shrink: 0;
        margin-top: 2px;
    }

    .form-group {
        margin-bottom: var(--cdv-space-4);
    }

    .form-group label {
        display: block;
        font-size: var(--cdv-font-size-sm);
        font-weight: var(--cdv-font-weight-medium);
        color: var(--cdv-color-text-primary);
        margin-bottom: var(--cdv-space-2);
    }

    .form-group input,
    .form-group textarea {
        width: 100%;
        padding: var(--cdv-space-3);
        background-color: var(--cdv-color-bg-base);
        border: 1px solid var(--cdv-color-border-default);
        border-radius: var(--cdv-radius-md);
        color: var(--cdv-color-text-primary);
        font-family: var(--cdv-font-mono);
        font-size: var(--cdv-font-size-sm);
    }

    .form-group textarea {
        resize: vertical;
        min-height: 80px;
    }

    .form-group input:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: var(--cdv-color-accent-500);
        box-shadow: 0 0 0 3px var(--cdv-color-accent-muted);
    }

    .field-note {
        font-size: var(--cdv-font-size-xs);
        color: var(--cdv-color-text-tertiary);
        margin-top: var(--cdv-space-1);
    }

    .error-message {
        padding: var(--cdv-space-3);
        background-color: var(--cdv-color-error-muted);
        border-radius: var(--cdv-radius-md);
        color: var(--cdv-color-error-500);
        font-size: var(--cdv-font-size-sm);
        margin-bottom: var(--cdv-space-4);
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--cdv-space-3);
        padding: var(--cdv-space-4) var(--cdv-space-5);
        border-top: 1px solid var(--cdv-color-border-subtle);
    }

    .primary-btn,
    .secondary-btn {
        padding: var(--cdv-space-2-5) var(--cdv-space-4);
        border-radius: var(--cdv-radius-md);
        font-size: var(--cdv-font-size-sm);
        font-weight: var(--cdv-font-weight-medium);
        cursor: pointer;
        transition: all var(--cdv-transition-fast) var(--cdv-ease-default);
    }

    .primary-btn {
        background-color: var(--cdv-color-accent-500);
        color: var(--cdv-color-bg-base);
        border: none;
    }

    .primary-btn:hover:not(:disabled) {
        background-color: var(--cdv-color-accent-400);
    }

    .primary-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .secondary-btn {
        background: transparent;
        color: var(--cdv-color-text-secondary);
        border: 1px solid var(--cdv-color-border-default);
    }

    .secondary-btn:hover {
        background-color: var(--cdv-color-bg-hover);
        color: var(--cdv-color-text-primary);
    }

    /* Fetching state */
    .fetching-section {
        text-align: center;
        padding: var(--cdv-space-6) 0;
    }

    .fetching-section h3 {
        color: var(--cdv-color-text-primary);
        margin: var(--cdv-space-4) 0 var(--cdv-space-3);
    }

    .spinner {
        width: 48px;
        height: 48px;
        border: 3px solid var(--cdv-color-border-subtle);
        border-top-color: var(--cdv-color-accent-500);
        border-radius: 50%;
        margin: 0 auto;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .progress-bar {
        height: 8px;
        background-color: var(--cdv-color-bg-base);
        border-radius: var(--cdv-radius-full);
        overflow: hidden;
        margin: var(--cdv-space-3) 0;
    }

    .progress-fill {
        height: 100%;
        background-color: var(--cdv-color-accent-500);
        transition: width 0.3s ease;
    }

    .progress-text {
        font-size: var(--cdv-font-size-sm);
        color: var(--cdv-color-text-secondary);
    }

    /* Complete state */
    .complete-section {
        text-align: center;
        padding: var(--cdv-space-4) 0;
    }

    .complete-icon {
        color: var(--cdv-color-success-500);
        margin-bottom: var(--cdv-space-3);
    }

    .complete-icon.has-errors {
        color: var(--cdv-color-warning-500);
    }

    .complete-section h3 {
        color: var(--cdv-color-text-primary);
        margin: 0 0 var(--cdv-space-2);
    }

    .stats {
        color: var(--cdv-color-text-secondary);
        font-size: var(--cdv-font-size-sm);
        margin-bottom: var(--cdv-space-4);
    }

    .errors-list {
        text-align: left;
        background-color: var(--cdv-color-error-muted);
        border-radius: var(--cdv-radius-md);
        padding: var(--cdv-space-3);
        margin-bottom: var(--cdv-space-4);
    }

    .errors-title {
        font-weight: var(--cdv-font-weight-medium);
        color: var(--cdv-color-error-500);
        margin: 0 0 var(--cdv-space-2);
        font-size: var(--cdv-font-size-sm);
    }

    .error-item {
        font-size: var(--cdv-font-size-xs);
        color: var(--cdv-color-error-500);
        font-family: var(--cdv-font-mono);
    }
</style>
