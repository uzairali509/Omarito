const axios = require("axios");

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const DATASET_ID = process.env.APIFY_DATASET_ID;

const api = axios.create({
    timeout: 30000
});

async function fetchDataset() {
    if (!APIFY_TOKEN) {
        throw new Error("APIFY_TOKEN missing.");
    }

    if (!DATASET_ID) {
        throw new Error("APIFY_DATASET_ID missing.");
    }

    const url =
        `https://api.apify.com/v2/datasets/${DATASET_ID}/items?token=${APIFY_TOKEN}&clean=true`;

    const { data } = await api.get(url);

    return data || [];
}

function detectCreator(item) {
    const username = (
        item.authorMeta?.name ||
        ""
    ).toLowerCase();

    const nickname = (
        item.authorMeta?.nickName ||
        ""
    ).toLowerCase();

    if (
        username.includes("omari") ||
        nickname.includes("omari")
    ) {
        return "Omar";
    }

    if (
        username.includes("dilan") ||
        nickname.includes("dilan")
    ) {
        return "Dylan";
    }

    if (
        username.includes("safia") ||
        nickname.includes("safia")
    ) {
        return "Sufiya";
    }

    return "Other";
}

function normalizeVideo(item) {

    const videoId =
        item.id ||
        item.videoId ||
        item.webVideoUrl?.split("/video/")[1]?.split("?")[0] ||
        "";

    if (!videoId)
        return null;

    return {

        videoId: String(videoId),

        creator: detectCreator(item),

        username:
            item.authorMeta?.name ||
            "",

        nickname:
            item.authorMeta?.nickName ||
            "",

        title:
            item.text ||
            "",

        description:
            item.text ||
            "",

        thumbnail:

            item.videoMeta?.coverUrl ||

            item.covers?.default ||

            item.covers?.dynamic ||

            item.covers?.origin ||

            "",

        playUrl:

            item.videoUrl ||

            "",

        webVideoUrl:

            item.webVideoUrl ||

            "",

        musicName:

            item.musicMeta?.musicName ||

            "",

        musicAuthor:

            item.musicMeta?.musicAuthor ||
            "",

        duration:

            item.videoMeta?.duration ||

            0,

        views:

            Number(item.playCount || 0),

        likes:

            Number(item.diggCount || 0),

        comments:

            Number(item.commentCount || 0),

        shares:

            Number(item.shareCount || 0),

        saves:

            Number(item.collectCount || 0),

        hashtags:

            (item.hashtags || []).map(h => typeof h === "string" ? h : (h.name || "")).filter(Boolean),

        avatar:

            item.authorMeta?.avatar ||

            "",

        verified:

            item.authorMeta?.verified ||

            false,

        videoLanguage:

            item.textLanguage ||

            "",

        country:

            item.region ||

            "",

        createTime:

            item.createTimeISO
                ? new Date(item.createTimeISO)
                : item.createTime
                    ? new Date(item.createTime * 1000)
                    : new Date(),

        source:
            "Apify",

        isTrending:
            false,

        isActive:
            true
    };

}

async function fetchTikTokVideos() {

    const items = await fetchDataset();

    console.log("Videos Found:", items.length);

    return items
        .map(normalizeVideo)
        .filter(Boolean);

}

module.exports = {
    fetchTikTokVideos
};
