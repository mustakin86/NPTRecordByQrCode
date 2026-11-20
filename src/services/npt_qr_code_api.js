const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyx8nt93QvuwFdSUgd6W-rA4S_NbV-EGhulIPqTcO2gVwjqXy_-0MdDqNdiYOMKORoj/exec';

const cacheStore = new Map();
const inflightRequests = new Map();

const DEFAULT_TTL = {
  problemCategories: 10 * 60 * 1000, 
  records: 15 * 1000, 
};

function getCached(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttlMs) {
  cacheStore.set(key, {
    data,
    expiry: Date.now() + ttlMs,
  });
}

function invalidateRecordsCache(sheetKey = '') {
  for (const key of cacheStore.keys()) {
    if (key.startsWith('records:')) {
      if (!sheetKey || key.startsWith(`records:${sheetKey}:`)) {
        cacheStore.delete(key);
      }
    }
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function deduplicateRequest(key, requestFn) {
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }
  const promise = requestFn().finally(() => {
    inflightRequests.delete(key);
  });
  inflightRequests.set(key, promise);
  return promise;
}

export const dbAPI = {
  async getRecords(
    sheetKey,
    spreadsheetId = '',
    { forceRefresh = false, ttlMs = DEFAULT_TTL.records } = {}
  ) {
    const cacheKey = `records:${sheetKey}:${spreadsheetId}`;

    if (!forceRefresh) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    return deduplicateRequest(cacheKey, async () => {
      try {
        let url = `${SCRIPT_URL}?sheet=${encodeURIComponent(sheetKey)}`;
        if (spreadsheetId) {
          url += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
        }

        const response = await fetchWithTimeout(url);
        const result = await response.json();

        if (result.success) {
          setCache(cacheKey, result.data, ttlMs);
          return result.data;
        }
        throw new Error(result.error || 'Failed to fetch records');
      } catch (error) {
        console.error('Error fetching records from Google Sheets:', error);
        const stale = cacheStore.get(cacheKey)?.data;
        return stale || [];
      }
    });
  },

  async getProblemCategories({ forceRefresh = false } = {}) {
    const cacheKey = 'problemCategories';

    if (!forceRefresh) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    return deduplicateRequest(cacheKey, async () => {
      try {
        const res = await fetchWithTimeout(
          `${SCRIPT_URL}?action=getProblemCategories`
        );
        const result = await res.json();
        if (result.success) {
          setCache(cacheKey, result.data, DEFAULT_TTL.problemCategories);
          return result.data;
        }
        return [];
      } catch (error) {
        console.error('Error fetching problem categories:', error);
        return cacheStore.get(cacheKey)?.data || [];
      }
    });
  },

  async saveRecord(sheetKey, recordData, actionType = 'create', retries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetchWithTimeout(
          SCRIPT_URL,
          {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              sheet: sheetKey,
              action: actionType,
              payload: recordData,
            }),
          },
          15000
        );

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to execute action');
        }

        invalidateRecordsCache(sheetKey);
        return result;
      } catch (error) {
        lastError = error;
        console.error(
          `Error sending data to Google Sheets (attempt ${attempt + 1}):`,
          error
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    throw lastError;
  },

  clearCache() {
    cacheStore.clear();
  },
};