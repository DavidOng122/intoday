// 假设你的核心代码都在 taskCardUtils.js 和 taskDisplayUtils.js 里
import { fetchSpotifyMeta, fetchMapMeta } from '../taskCardUtils.js';

// 在同级目录 (src/lib/) 寻找 taskDisplayUtils.js 和 cardTypeDetection.js
import { deriveTaskDisplayTitle } from './taskDisplayUtils.js';
import { CARD_TYPES } from './cardTypeDetection.js';
async function runTests() {
    console.log('🚀 开始测试 Qiro 链接解析引擎...\n');

    // ==========================================
    // 测试 1: Spotify 音乐链接抓取
    // ==========================================
    console.log('🎵 [测试 1] 正在抓取 Spotify 链接...');
    // 在 test-parser.js 里修改这一行：
    // 在 test-parser.js 里修改这行：
    const spotifyUrl = 'https://open.spotify.com/track/0KKkJNfGyhkQ5aFogxQAPU?si=Japsw1sQQ1i8QnmwLXNNDw&context=spotify%3Aplaylist%3A37i9dQZF1E4vTHVDH1FT3Y'; // 这是一首真正的歌 (Rick Astley) 

    const spotifyMeta = await fetchSpotifyMeta(spotifyUrl);
    console.log('API 返回的 Meta:', spotifyMeta);

    // 模拟数据库里的 Task 对象
    const mockSpotifyTask = {
        cardType: CARD_TYPES.MUSIC,
        primaryUrl: spotifyUrl,
        musicTitle: spotifyMeta.musicTitle, // 注入我们抓到的标题
    };

    const finalSpotifyTitle = deriveTaskDisplayTitle(mockSpotifyTask);
    console.log('✅ UI 最终展示的标题:', finalSpotifyTitle);
    console.log('--------------------------------------------------\n');

    // ==========================================
    // 测试 2: Google Maps 特殊 /3 变体解析
    // ==========================================
    console.log('🗺️ [测试 2] 正在解析 Google Maps (/3) 链接...');
    // 模拟包含 /3 的搜索链接
    const mapsUrl = 'https://maps.app.goo.gl/qc689D1KstqwhNhn6?g_st=ic?q=Tokyo+Zokei+University';

    const mapsMeta = await fetchMapMeta(mapsUrl);
    console.log('API 返回的 Meta:', mapsMeta);

    // 模拟数据库里的 Task 对象
    const mockMapsTask = {
        cardType: CARD_TYPES.PLACE,
        primaryUrl: mapsUrl,
        mapTitle: mapsMeta.mapTitle,
    };

    const finalMapsTitle = deriveTaskDisplayTitle(mockMapsTask);
    console.log('✅ UI 最终展示的地名:', finalMapsTitle);
    console.log('--------------------------------------------------\n');
}

runTests();