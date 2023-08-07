<script lang="ts">
    import { onMount } from "svelte";

    let contribGoal = '';
    let submitted = false;

    function handleSubmit() {
        // Look for similar issues
        tsvscode.postMessage({
        type: "onGoal",
        value: contribGoal
        });

        submitted = true;
    }

    onMount(() => {
        // Handle messages sent from the extension to the webview
        window.addEventListener('message', event => {
            const message = event.data; // The json data that the extension sent
            switch (message.type) {
                case 'goal-definition':
                    // Set the goal value
                    contribGoal = message.value;
                    submitted = true;
                    break;
            }
        });
    })
</script>


<h3>What are you working on?</h3>
{#if !submitted}
<form on:submit|preventDefault={handleSubmit}>
    <input bind:value={contribGoal} />
</form>
{:else}
<div>
    <p>{contribGoal}</p>
</div>
{/if}


<!-- 
<button 
    on:click={() => {
        tsvscode.postMessage({
            type: "onFindStarterIssues",
            value: "Find starter issues"
        });
    }}>Find starter issues</button> -->