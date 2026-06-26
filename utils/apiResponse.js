/** Small helpers for consistent JSON API responses (non-breaking wrappers). */

function sendError(res, status, message, extra = {}) {
    return res.status(status).json({ error: message, ...extra });
}

function sendSuccess(res, payload = {}, status = 200) {
    return res.status(status).json(payload);
}

module.exports = {
    sendError,
    sendSuccess,
};
