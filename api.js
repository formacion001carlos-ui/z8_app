// api.js
const API_URL = "https://script.google.com/macros/s/AKfycbxYvgvfRfXUULMEO1sfKGKZt1Lf0IK_SqK-rLXJiDMP2OUJYZtt2sJrj404WvDdrQT6/exec";

async function fetchGoogleAPI(action, payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, payload: payload }),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            }
        });
        const result = await response.json();
        if (result.status === "error") throw new Error(result.message);
        return result.data;
    } catch (error) {
        console.error("Error de conexión con la base de datos:", error);
        throw error;
    }
}
