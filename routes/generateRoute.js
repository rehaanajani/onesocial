/**
 * routes/generateRoute.js
 *
 * POST /api/generate
 *
 * Smart 3-stage AI pipeline:
 *   Stage 1 — ANALYSE: Vision AI understands content + image
 *   Stage 2 — ENGINEER: Local prompt builder crafts platform-specific prompts
 *   Stage 3 — GENERATE: Parallel caption + image generation per platform
 */

const express = require('express');
const router = express.Router();

const { analyse } = require('../services/analysisService');
const { buildPrompts } = require('../services/promptEngineerService');
const { generateCaption } = require('../services/captionService');
const { generateImage } = require('../services/imageService');

const SUPPORTED_PLATFORMS = ['instagram', 'linkedin', 'x'];

router.post('/', async (req, res) => {
    try {
        const {
            content = '',
            platforms = [],
            captionVibe = '',
            accountType = 'personal',
            manualCaption = '',
            imageAction = 'generate_new',
            primaryImage = null,      // base64 string from frontend
            platformContexts = {},
            imageStyle = 'auto',      // new: visual aesthetic preference
            colorPalette = 'auto',    // new: color palette preference
            contentNiche = '',        // new: content niche hint
        } = req.body;

        // ── 1. Validate ──────────────────────────────────────────────────────
        const stringFields = { content, captionVibe, accountType, manualCaption, imageAction, imageStyle, colorPalette, contentNiche };
        const badField = Object.keys(stringFields).find((k) => typeof stringFields[k] !== 'string');
        if (badField) {
            return res.status(400).json({
                error: 'Validation Error',
                message: `"${badField}" must be a string.`,
            });
        }

        if (primaryImage !== null && typeof primaryImage !== 'string') {
            return res.status(400).json({
                error: 'Validation Error',
                message: '"primaryImage" must be a base64 string or null.',
            });
        }

        const hasContent = content.trim().length > 0;
        const hasManualCaption = manualCaption.trim().length > 0;

        if (!hasContent && !hasManualCaption) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '"content" is required (or provide a "manualCaption").',
            });
        }

        if (!Array.isArray(platforms) || platforms.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '"platforms" must be a non-empty array.',
            });
        }

        const invalidPlatforms = platforms.filter(
            (p) => typeof p !== 'string' || !SUPPORTED_PLATFORMS.includes(p.toLowerCase())
        );
        if (invalidPlatforms.length > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: `Unsupported platforms: ${invalidPlatforms.join(', ')}.`,
            });
        }

        // De-duplicate so ["x", "X"] doesn't generate the same platform twice
        const normalisedPlatforms = [...new Set(platforms.map((p) => p.toLowerCase()))];

        console.log(
            `[generate] platforms=${normalisedPlatforms.join(',')} | action=${imageAction} | vibe=${captionVibe} | niche=${contentNiche} | style=${imageStyle}`
        );

        // ── 2. STAGE 1 — Content Analysis ────────────────────────────────────
        // Skip analysis if user is writing their own caption AND keeping original image
        const skipAnalysis = hasManualCaption && imageAction === 'keep_original';
        let analysis = null;

        if (!skipAnalysis) {
            console.log('[generate] Stage 1: Analysing content...');
            analysis = await analyse(content, primaryImage, contentNiche);
        }

        // ── 3. STAGE 2 — Prompt Engineering ──────────────────────────────────
        let engineeredPrompts = null;

        if (analysis) {
            console.log('[generate] Stage 2: Engineering prompts...');
            const userPrefs = { vibe: captionVibe, accountType, imageStyle, colorPalette, imageAction };
            engineeredPrompts = buildPrompts(analysis, userPrefs, normalisedPlatforms, platformContexts);
        }

        // ── 4. STAGE 3 — Generate per platform ───────────────────────────────
        console.log('[generate] Stage 3: Generating content...');

        const platformSettled = await Promise.allSettled(
            normalisedPlatforms.map(async (platform) => {
                // Get engineered prompts for this platform (if available)
                const platformPrompts = engineeredPrompts?.perPlatform?.[platform] || {};

                // Image generation — use engineered image prompt if available
                const image = await generateImage(
                    platform,
                    content,
                    imageAction,
                    primaryImage || null,
                    platformPrompts.imagePrompt || null   // ← engineered prompt
                );

                // Caption generation — use engineered caption prompt if available
                // If user wrote their own, manualCaption is used directly in captionService
                const captionOptions = {
                    vibe: captionVibe,
                    accountType,
                    context: platformContexts[platform] || {},
                    engineeredPrompt: platformPrompts.captionPrompt || null,  // ← engineered prompt
                };
                const caption = await generateCaption(
                    platform,
                    content,
                    captionOptions,
                    manualCaption || null
                );

                return { platform, caption, image };
            })
        );

        // ── 5. Separate successes from failures ───────────────────────────────
        const response = {};
        const failures = [];

        platformSettled.forEach((result, i) => {
            const platform = normalisedPlatforms[i];
            if (result.status === 'fulfilled') {
                const { caption, image } = result.value;
                response[platform] = { caption, image };
            } else {
                console.error(`[generate] Failed for ${platform}:`, result.reason?.message);
                failures.push({ platform, error: result.reason?.message || 'Unknown error' });
            }
        });

        if (Object.keys(response).length === 0) {
            return res.status(500).json({
                error: 'Generation Failed',
                message: 'All platform generations failed.',
                failures,
            });
        }

        return res.status(200).json({
            ...response,
            ...(failures.length > 0 ? { _warnings: failures } : {}),
        });

    } catch (error) {
        console.error('[generate] Unexpected error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Something went wrong. Please try again.',
        });
    }
});

module.exports = router;
