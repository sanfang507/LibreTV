// 原 searchByAPIAndKeyWord 改为 async generator
async function* searchByAPIAndKeyWordStream(apiId, query) {
    let apiUrl, apiName, apiBaseUrl;
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

    const firstPage = await fetchPage(apiId, apiName, apiBaseUrl, apiUrl, query, 1);
    for (const item of firstPage) yield item;

    const pageCount = firstPage.pagecount || 1;
    const pagesToFetch = Math.min(pageCount - 1, API_CONFIG.search.maxPages - 1);

    if (pagesToFetch > 0) {
        const pagePromises = [];
        for (let page = 2; page <= pagesToFetch + 1; page++) {
            const pageUrl = apiBaseUrl + API_CONFIG.search.pagePath
                .replace('{query}', encodeURIComponent(query))
                .replace('{page}', page);
            pagePromises.push(fetchPage(apiId, apiName, apiBaseUrl, pageUrl, query, page));
        }

        for (const pagePromise of pagePromises) {
            try {
                const pageResults = await pagePromise;
                for (const item of pageResults) yield item;
            } catch (e) {
                console.warn(e);
            }
        }
    }
}
