const axios = require("axios");

const APIFY_TOKEN = process.env.APIFY_TOKEN || "apify_api_e1od1PLQywf6O5PIEzMSCy5QpanjeK3s7uZP";

async function main() {
    // List available actors/tasks
    console.log("=== Listing Apify Actors ===");
    try {
        const { data } = await axios.get(
            `https://api.apify.com/v2/acts?token=${APIFY_TOKEN}&limit=25`,
            { timeout: 15000 }
        );
        console.log("Total actors:", data.data?.total);
        if (data.data?.items) {
            data.data.items.forEach(act => {
                console.log(`  - ${act.name} (id: ${act.id})`);
            });
            
        }
    } catch (e) {
        console.log("Actors list error:", e.message);
    }

    // List available tasks (scheduled tasks)
    console.log("\n=== Listing Apify Tasks ===");
    try {
        const { data } = await axios.get(
            `https://api.apify.com/v2/actor-tasks?token=${APIFY_TOKEN}&limit=25`,
            { timeout: 15000 }
        );
        console.log("Total tasks:", data.data?.total);
        if (data.data?.items) {
            data.data.items.forEach(task => {
                console.log(`  - ${task.name || task.id} (id: ${task.id})`);
                console.log(`    actorId: ${task.actId}`);
                console.log(`    lastRun: ${task.lastRunAt || 'never'}`);
            });
        }
    } catch (e) {
        console.log("Tasks list error:", e.message);
    }

    // Check the dataset
    console.log("\n=== Checking Dataset ===");
    try {
        const { data } = await axios.get(
            `https://api.apify.com/v2/datasets/hgHKnogn5bASQtY1P?token=${APIFY_TOKEN}`,
            { timeout: 15000 }
        );
        console.log("Dataset name:", data.data?.name);
        console.log("Item count:", data.data?.itemCount);
        console.log("Created:", data.data?.createdAt);
        console.log("Modified:", data.data?.modifiedAt);
    } catch (e) {
        console.log("Dataset error:", e.message);
    }
}

main().catch(e => console.error("FATAL:", e.message));
