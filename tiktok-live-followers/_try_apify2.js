require("dotenv").config();
const axios = require("axios");

const APIFY_TOKEN = process.env.APIFY_TOKEN;

async function main() {
    // Try running the popular clockworks/tiktok-scraper
    const ACTOR_ID = "clockworks~tiktok-scraper";
    
    console.log("Trying clockworks tiktok-scraper...");
    try {
        const input = {
            profiles: [
                { url: "https://www.tiktok.com/@omari.to" },
                { url: "https://www.tiktok.com/@dilandyalieva" },
                { url: "https://www.tiktok.com/@hello.safia" }
            ],
            maxItemsPerUser: 35,
            resultsPerPage: 35
        };

        const { data } = await axios.post(
            `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
            input,
            { timeout: 30000, headers: { "Content-Type": "application/json" } }
        );
        
        console.log("Run started! ID:", data.data?.id, "Status:", data.data?.status);
        console.log("Dataset:", data.data?.defaultDatasetId);
        
        // Poll for completion
        const runId = data.data?.id;
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const st = await axios.get(`https://api.apify.com/v2/runs/${runId}?token=${APIFY_TOKEN}`, { timeout: 15000 });
            const status = st.data?.data?.status;
            const items = st.data?.data?.stats?.datasetItems || 0;
            process.stdout.write(`\r  ${status} - ${items} items (${(i+1)*5}s)`);
            
            if (["SUCCEEDED","FAILED","ABORTED","TIMED-OUT"].includes(status)) {
                console.log(`\nDone: ${status}, items: ${items}`);
                if (status === "SUCCEEDED") {
                    console.log("Dataset:", st.data?.data?.defaultDatasetId);
                }
                break;
            }
        }
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.error("Status:", e.response.status, JSON.stringify(e.response.data).substring(0, 300));
    }
    
    // Also try our custom actor with different input
    console.log("\n\nTrying custom actor with startUrls format...");
    try {
        const input = {
            startUrls: [
                { url: "https://www.tiktok.com/@omari.to" },
                { url: "https://www.tiktok.com/@dilandyalieva" },
                { url: "https://www.tiktok.com/@hello.safia" }
            ],
            maxItems: 35
        };

        const { data } = await axios.post(
            `https://api.apify.com/v2/acts/GdWCkxBtKWOsKjdch/runs?token=${APIFY_TOKEN}`,
            input,
            { timeout: 30000, headers: { "Content-Type": "application/json" } }
        );
        
        console.log("Run started! ID:", data.data?.id, "Status:", data.data?.status);
        
        const runId = data.data?.id;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const st = await axios.get(`https://api.apify.com/v2/runs/${runId}?token=${APIFY_TOKEN}`, { timeout: 15000 });
            const status = st.data?.data?.status;
            const items = st.data?.data?.stats?.datasetItems || 0;
            process.stdout.write(`\r  ${status} - ${items} items (${(i+1)*5}s)`);
            
            if (["SUCCEEDED","FAILED","ABORTED","TIMED-OUT"].includes(status)) {
                console.log(`\nDone: ${status}, items: ${items}`);
                break;
            }
        }
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.error("Status:", e.response.status, JSON.stringify(e.response.data).substring(0, 300));
    }
}

main();
