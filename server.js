/**
 * server.js
 *
 * Local Development Entry Point
 *
 * The Express app lives in `api/index.js` so Vercel can serve it as a
 * serverless function. This file starts it on a port for `npm run dev`.
 * Keeping listen() here means tests can import the app without binding a port.
 */
const app = require('./api/index.js');

const PORT = process.env.PORT || 5000;
const RATE_LIMIT_MAX = app.locals.rateLimitMax;

app.listen(PORT, () => {
    console.log("\n🚀 OneSocial Backend running");
    console.log(`   Server      : http://localhost:${PORT}`);
    console.log(`   Provider    : ${(process.env.AI_PROVIDER || "bedrock").toUpperCase()}`);
    console.log(`   Rate limit  : ${RATE_LIMIT_MAX} req/min per IP`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
    console.log(`   Generate    : POST http://localhost:${PORT}/api/generate\n`);
});
