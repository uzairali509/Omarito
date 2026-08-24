require("dotenv").config();
const axios = require("axios");

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = "GdWCkxBtKWOsKjdch";

async function main() {
    // Try to start a new run of the tiktok-scraper actor
    // with input to scrape the three creators
    console.log("Starting Apify actor run...");
    
    try {
        const input = {
            profiles: [
                { url: "https://www.tiktok.com/@omari.to" },
                { url: "https://www.tiktok.com/@dilandyalieva" },
                { url: "https://www.tiktok.com/@hello.safia" }
            ],
            resultsPerPage: 30,
            maxItemsPerUser: 30
        };

        const { data } = await axios.post(
            `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
            input,
            { 
                timeout: 30000,
                headers: { "Content-Type": "application/json" }
            }
        );
        
        console.log("Run started!");
        console.log("Run ID:", data.data?.id);
        console.log("Status:", data.data?.status);
        console.log("Dataset ID:", data.data?.defaultDatasetId);
        console.log("Started at:", data.data?.startedAt);
        
        // Poll for completion
        const runId = data.data?.id;
        const datasetId = data.data?.defaultDatasetId;
        
        if (!runId) {
            console.log("No run ID returned");
            return;
        }
        
        console.log("\nPolling for completion...");
        let attempts = 0;
        while (attempts < 60) { // max 5 minutes
            await new Promise(r => setTimeout(r, 5000));
            attempts++;
            
            const status = await axios.get(
                `https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${APIFY_TOKEN}`,
                { timeout: 15000 }
            );
            
            const st = status.data?.data?.status;
            const items = status.data?.data?.stats?.datasetItems || 0;
            process.stdout.write(`\r  ${st} - ${items} items (${attempts * 5}s)`);
            
            if (st === "SUCCEEDED" || st === "FAILED" || st === "ABORTED" || st === "TIMED-OUT") {
                console.log(`\n\nFinal status: ${st}`);
                console.log("Dataset items:", items);
                
                if (st === "SUCCEEDED" && datasetId) {
                    // Check the dataset
                    const ds = await axios.get(
                        `https://api.apify.com/v2/datasets/${datasetId}?token=${APIFY_TOKEN}`,
                        { timeout: 15000 }
                    );
                    console.log("Dataset itemCount:", ds.data?.data?.itemCount);
                    console.log("Dataset modifiedAt:", ds.data?.data?.modifiedAt);
                }
                break;
            }
        }
        
        if (attempts >= 60) {
            console.log("\nTimeout waiting for run to complete");
        }
        
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", JSON.stringify(e.response.data).substring(0, 500));
        }
    }
}

main();
