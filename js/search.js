async function* searchByAPIAndKeyWordStream(apiId, query) {
    const { apiUrl, apiName, apiBaseUrl } = getApiInfo(apiId, query);
    if (!apiUrl) return;

    // 获取第一页
    const firstPage = await fetchPage(apiId, apiName, apiBaseUrl, apiUrl, query, 1);
    if (!firstPage) return;
    for (const item of firstPage) yield item;

    const pageCount = firstPage.pagecount || 1;
    const pagesToFetch = Math.min(pageCount - 1, API_CONFIG.search.maxPages - 1);

    if (pagesToFetch > 0) {
        const pagePromises = new Map();

        for (let page = 2; page <= pagesToFetch + 1; page++) {
            const pageUrl = apiBaseUrl + API_CONFIG.search.pagePath
                .replace('{query}', encodeURIComponent(query))
                .replace('{page}', page);
            const promise = fetchPage(apiId, apiName, apiBaseUrl, pageUrl, query, page)
                .catch(err => {
                    console.warn(`Page ${page} fetch failed:`, err);
                    return [];
                });
            pagePromises.set(page, promise);
        }

        // 边请求边 yield
        for (let page = 2; page <= pagesToFetch + 1; page++) {
            const pageResults = await pagePromises.get(page);
            for (const item of pageResults) yield item;
        }
    }
}

// 提取获取 API 信息逻辑
function getApiInfo(apiId, query) {
    let apiBaseUrl, apiUrl, apiName;
    if (apiId.startsWith('custom_')) {
        const customIndex = apiId.replace('custom_', '');
        const customApi = getCustomApiInfo(customIndex);
        if (!customApi) return {};
        apiBaseUrl = customApi.url;
        apiName = customApi.name;
    } else {
        if (!API_SITES[apiId]) return {};
        apiBaseUrl = API_SITES[apiId].api;
        apiName = API_SITES[apiId].name;
    }
    apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
    return { apiUrl, apiName, apiBaseUrl };
}
