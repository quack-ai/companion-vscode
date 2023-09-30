<!-- Copyright (C) 2023, Quack AI.

This program is licensed under the Apache License 2.0.
See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details. -->

<script lang="ts">
    import { onMount } from "svelte";
    type quackGuideline = { id: number, order: number, repo_id: number, title: string, details: string, created_at: string, updated_at: string, completed: boolean, expanded: boolean };

    let submitted = false;

    let repoGuidelines: Array<quackGuideline> = [];

    onMount(() => {
        // Handle messages sent from the extension to the webview
        window.addEventListener('message', event => {
            const message = event.data; // The json data that the extension sent
            switch (message.type) {
                case 'repo-guidelines':
                    // Sort them by order & add completed attribute
                    repoGuidelines = message.value.sort((a: quackGuideline, b: quackGuideline) => a.order - b.order).map((guideline: any) => ({
                        ...guideline,
                        completed: false,
                        expanded: false,
                    }));
                    break;
            }
        });
    })
</script>

<style>
    .complete {
        text-decoration: line-through;
    }
    .title {
        cursor: pointer;
    }

    .details {
        margin-left: 5px;
        font-style: italic;
        border-left: 2px solid #007acc;
        padding-left: 10px;
        margin-top: 5px;
    }
</style>

<ul>
    {#each repoGuidelines as guideline (guideline.title)}
        <div>
        <input type="checkbox"
            class:complete={guideline.completed}
            on:click={() => {
                guideline.completed = !guideline.completed;
            }}
        >
        <span 
            class="title" 
            on:click={() => guideline.expanded = !guideline.expanded}
        >
        {guideline.title} {guideline.expanded ? "▼" : "◂"}
        </span>
        {#if guideline.expanded}
            <p class="details">{guideline.details}</p>
        {/if}
        </div>
    {/each}
</ul>

