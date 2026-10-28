/**
 * server.js
 *
 * OneSocial Backend – Express Server Entry Point
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const generateRoute = require("../routes/generateRoute");

const app = express();

// Vercel (and most hosts) sit behind one proxy hop; without this req.ip is the
// proxy's address and every visitor shares a single rate-limit bucket.
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;

// ── Simple In-Memory Rate Limiter ─────────────────────────────────────────
// Limits each IP to RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS.
// Resets automatically. No external dependency needed.

const RATE_LIMIT_WINDOW_MS = 60 * 1000;  // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "10", 10);
const rateLimitMap = new Map();

// Drop expired windows so the map doesn't grow forever on a long-lived server
setInterval(() => {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    for (const [ip, entry] of rateLimitMap) {
        if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
    }
}, RATE_LIMIT_WINDOW_MS).unref();

function rateLimiter(req, res, next) {
    const ip = req.ip || "unknown";
    const now = Date.now();

    let entry = rateLimitMap.get(ip);

    // Reset window if expired
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        entry = { count: 0, windowStart: now };
    }

    entry.count++;
    rateLimitMap.set(ip, entry);

    const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
    const resetIn = Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);

    res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetIn);

    if (entry.count > RATE_LIMIT_MAX) {
        console.warn(`[rate-limit] IP ${ip} exceeded ${RATE_LIMIT_MAX} req/min`);
        return res.status(429).json({
            error: "Too Many Requests",
            message: `You've hit the rate limit. Please wait ${resetIn}s before trying again.`,
            retryAfterSeconds: resetIn,
        });
    }

    next();
}

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

// Increase body size limit to handle base64 image payloads (up to 10 MB)
app.use(express.json({ limit: "10mb" }));

// ── Routes ────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        provider: process.env.AI_PROVIDER || "openrouter",
        rateLimit: `${RATE_LIMIT_MAX} req/min`,
        timestamp: new Date().toISOString(),
    });
});

// Apply rate limiter only to the generate endpoint (not health checks)
app.use("/api/generate", rateLimiter, generateRoute);

// ── 404 Handler ───────────────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({ error: "Not Found", message: "Route does not exist." });
});

// ── Global Error Handler ──────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    // Body-parser errors are the client's fault: bad JSON or a body over the limit
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Bad Request", message: "Request body is not valid JSON." });
    }
    if (err.type === "entity.too.large") {
        return res.status(413).json({ error: "Payload Too Large", message: "Request body exceeds the 10 MB limit." });
    }

    console.error("[global-error-handler]", err.stack);
    res.status(500).json({
        error: "Internal Server Error",
        message: "Unexpected server error",
    });
});

// ── Start Server (Local only) ───────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log("\n🚀 OneSocial Backend running");
        console.log(`   Server      : http://localhost:${PORT}`);
        console.log(`   Provider    : ${(process.env.AI_PROVIDER || "openrouter").toUpperCase()}`);
        console.log(`   Rate limit  : ${RATE_LIMIT_MAX} req/min per IP`);
        console.log(`   Health check: http://localhost:${PORT}/health`);
        console.log(`   Generate    : POST http://localhost:${PORT}/api/generate\n`);
    });
}

// Export for Vercel Serverless
module.exports = app;