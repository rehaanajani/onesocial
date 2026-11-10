/**
 * services/promptService.js
 *
 * Builds AI prompts for captions and image processing.
 * Accepts rich context: vibe, accountType, imageAction, platformContext.
 */

const { platformConfig, vibeModifiers, imageActionPrompts } = require("../utils/platformConfig");

// ─────────────────────────────────────────────────────────────────────────────
// Caption Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a caption generation prompt for a specific platform.
 *
 * @param {string} platform       - "instagram" | "linkedin" | "x"
 * @param {string} content        - User's raw idea / text
 * @param {object} options
 * @param {string} options.vibe        - Key from vibeModifiers (e.g. "funny")
 * @param {string} options.accountType - "personal" | "business"
 * @param {object} options.context     - Platform-specific context (postType, audience, goal, etc.)
 */
function buildCaptionPrompt(platform, content, options = {}) {
  const config = platformConfig[platform];
  if (!config) throw new Error(`Unsupported platform: ${platform}`);

  const { vibe, accountType, context = {} } = options;

  // ── Vibe modifier ──────────────────────────────────────────────────────────
  const vibeText = vibe && vibeModifiers[vibe]
    ? `\nTone / Vibe:\n${vibeModifiers[vibe]}`
    : "";

  // ── Account type modifier ──────────────────────────────────────────────────
  const accountText = accountType
    ? `\nAccount type: ${accountType === "business" ? "Business / Brand account — professional and consistent." : "Personal account — authentic and individual."}`
    : "";

  // ── Platform context modifiers ─────────────────────────────────────────────
  const contextParts = [];
  const contextDefs = config.contextPrompts || {};

  for (const [key, value] of Object.entries(context)) {
    if (contextDefs[key] && contextDefs[key][value]) {
      contextParts.push(contextDefs[key][value]);
    }
  }
  const contextText = contextParts.length
    ? `\nAdditional context:\n${contextParts.map((c) => `- ${c}`).join("\n")}`
    : "";

  return `
You are an expert social media copywriter.

Topic / Idea:
"${content}"

Your task:
${config.captionStyle}
${vibeText}
${accountText}
${contextText}

Write a compelling caption optimized for engagement.

Respond with ONLY the caption text.
No explanations.
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an image generation / editing prompt.
 *
 * @param {string} platform    - "instagram" | "linkedin" | "x"
 * @param {string} content     - User's raw idea / text
 * @param {string} imageAction - Key from imageActionPrompts
 * @returns {string|null} Prompt string, or null if action is "keep_original"
 */
function buildImagePrompt(platform, content, imageAction = "generate_new") {
  const config = platformConfig[platform];
  if (!config) throw new Error(`Unsupported platform: ${platform}`);

  // keep_original means no AI image processing
  const actionInstruction = imageActionPrompts[imageAction];
  if (actionInstruction === null) return null;

  const action = actionInstruction || imageActionPrompts.generate_new;

  const baseVisualStyle = `
modern social media marketing poster,
clean minimal startup aesthetic,
orange gradient lighting,
futuristic tech elements,
high quality digital design,
bold typography space,
professional marketing graphic
`.trim();

  const platformVisualStyles = {
    instagram: "square composition, vibrant colors, visually engaging layout, attention grabbing design",
    linkedin: "professional corporate visual, clean business aesthetic, modern tech startup branding, landscape 1200x627",
    x: "wide banner 16:9, dynamic layout, bold tech themed visuals, high contrast",
  };

  const platformStyle = platformVisualStyles[platform] || "";

  return `
Action: ${action}

Topic: "${content}"

Base visual style: ${baseVisualStyle}

Platform style: ${platformStyle}

Additional requirements: ${config.imageStyle}

CRITICAL: Preserve the authenticity of the original image. Do not change the subject, location, ethnicity, or core composition unless explicitly instructed by the action above.
`.trim();
}

module.exports = { buildCaptionPrompt, buildImagePrompt };
