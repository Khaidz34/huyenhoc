import API_CONFIG from '../config/api.js';

const BASE_URL = API_CONFIG.BASE_URL;

export const apiClient = {
    get: async (endpoint, params = {}) => {
        // Remove leading slash from endpoint if present
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        // Build full URL by concatenating BASE_URL and endpoint
        const fullUrl = `${BASE_URL}/${cleanEndpoint}`;
        const url = new URL(fullUrl);

        // Append query params
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                url.searchParams.append(key, params[key]);
            }
        });

        console.log(`[API] Fetching: ${url.toString()}`);

        const response = await fetch(url.toString(), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    },

    post: async (endpoint, data = {}) => {
        // Remove leading slash from endpoint if present
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        // Build full URL by concatenating BASE_URL and endpoint
        const fullUrl = `${BASE_URL}/${cleanEndpoint}`;
        const url = new URL(fullUrl);

        console.log(`[API] Posting: ${url.toString()}`);

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    },

    analyze: (data) => apiClient.get('/analyze', data),
    analyzeTime: (data) => apiClient.get('/analyze-time', data),
    selectDates: (data) => apiClient.get('/select-dates', data),
    matching: (data) => apiClient.post('/matching', data),
    matchingAI: (data, token) => {
        // Remove leading slash from endpoint if present
        const cleanEndpoint = '/matching/ai'.startsWith('/') ? '/matching/ai'.slice(1) : '/matching/ai';
        const fullUrl = `${BASE_URL}/${cleanEndpoint}`;
        
        return fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        }).then(res => {
            if (!res.ok) {
                return res.text().then(text => {
                    try {
                        const errData = JSON.parse(text);
                        return errData; // Return error object with { error: ... } to be handled by caller
                    } catch (e) {
                        throw new Error(`Lỗi kết nối máy chủ (${res.status}). Vui lòng thử lại sau.`);
                    }
                });
            }
            return res.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error('Phản hồi không hợp lệ từ máy chủ. Vui lòng thử lại sau.');
                }
            });
        });
    },
    askAI: (data, token) => {
        // Remove leading slash from endpoint if present
        const cleanEndpoint = '/consultant/ask'.startsWith('/') ? '/consultant/ask'.slice(1) : '/consultant/ask';
        const fullUrl = `${BASE_URL}/${cleanEndpoint}`;
        
        return fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        }).then(res => {
            if (!res.ok) {
                return res.json().then(err => {
                    throw new Error(err.error || `API Error: ${res.status}`);
                });
            }
            return res.json();
        });
    }
};
