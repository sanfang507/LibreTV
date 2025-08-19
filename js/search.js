/**
 * 异步生成器：按 API 和关键字搜索，逐条返回结果
 * @param {string} apiId API ID（可自定义或内置）
 * @param {string} query 搜索关键词
 */
async function* searchByAPIAndKeyWordStream(apiId, query) {
    let apiBaseUrl, apiUrl, apiName;

    try {
        // 1️⃣ 判断是自定义 API 还是内置 API
        if (apiId.startsWith('custom_')) {
            const customIndex = apiId.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) return;
            apiBaseUrl = customApi.url;
            apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
            apiName = customApi.name;
        } else {
            if (!API_SITES[apiId]) return;
            apiBaseUrl = API_SITES[apiId].api;
            apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
            apiName = API_SITES[apiId].name;
        }

        // 2️⃣ 获取第一页结果
        const firstPageItems = await fetchPageResults(apiUrl, apiId, apiName, apiBaseUrl);
        for (const item of firstPageItems) yield item;

        // 3️⃣ 获取分页信息
        const totalPages = firstPageItems.pagecount || 1;
        const maxPages = Math.min(API_CONFIG.search.maxPages || 5, totalPages);

        // 4️⃣ 依次抓取剩余页
        for (let page = 2; page <= maxPages; page++) {
            const pageUrl = apiBaseUrl + API_CONFIG.search.pagePath
                .replace('{query}', encodeURIComponent(query))
                .replace('{page}', page);

            const pageItems = await fetchPageResults(pageUrl, apiId, apiName, apiBaseUrl);
            for (const item of pageItems) yield item;
        }

    } catch (error) {
        console.warn(`API ${apiId} 搜索异常:`, error);
        return;
    }
}

/**
 * 抓取单页结果，带超时和代理鉴权
 * @param {string} url 页面 URL
 * @param {string} apiId API ID
 * @param {string} apiName API 名
 * @param {string} apiBaseUrl API 基础 URL
 */
async function fetchPageResults(url, apiId, apiName, apiBaseUrl) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const proxiedUrl = await (window.ProxyAuth?.addAuthToProxyUrl ?
            window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(url)) :
            PROXY_URL + encodeURIComponent(url)
        );

        const response = await fetch(proxiedUrl, {
            headers: API_CONFIG.search.headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) return [];

        const data = await response.json();
        if (!data?.list || !Array.isArray(data.list)) return [];

        // 处理结果，每条增加来源信息
        return data.list.map(item => ({
            ...item,
            source_name: apiName,
            source_code: apiId,
            api_url: apiId.startsWith('custom_') ?
                getCustomApiInfo(apiId.replace('custom_', ''))?.url : undefined
        }));
    } catch (error) {
        console.warn(`API ${apiId} 页面抓取失败:`, error);
        return [];
    }
}
