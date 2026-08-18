const config = require("../config/moderation.json");

const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;
const WORD_CHARACTER = "[\\p{L}\\p{N}]";

function normalizeText(value) {
  let text = typeof value === "string" ? value : "";
  const settings = config.settings.normalization;

  if (settings.unicodeNormalize) text = text.normalize("NFKC");
  if (settings.removeZeroWidthCharacters) text = text.replace(ZERO_WIDTH_CHARACTERS, "");
  if (settings.lowercase) text = text.toLowerCase();
  if (settings.collapseWhitespace) text = text.replace(/\s+/gu, " ").trim();

  return text;
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileTerm(term) {
  const normalizedTerm = normalizeText(term);
  return {
    term: normalizedTerm,
    expression: new RegExp(
      `(?<!${WORD_CHARACTER})${escapeRegularExpression(normalizedTerm)}(?!${WORD_CHARACTER})`,
      "u"
    )
  };
}

function compilePattern(pattern) {
  return new RegExp(pattern, "u");
}

const signals = {
  severe_slur: config.terms.severe_slurs.map(compileTerm),
  moderate_slur: config.terms.moderate_slurs.map(compileTerm),
  hate_phrase: config.patterns.hate_phrases.map((pattern) => ({
    term: pattern,
    expression: compilePattern(pattern)
  }))
};

function moderateText(value, options = {}) {
  const normalized = normalizeText(value);
  const scores = config.settings.scores;
  const flagThreshold = options.flagThreshold ?? config.settings.chat.flagThreshold;
  const blockThreshold = options.blockThreshold ?? config.settings.chat.blockThreshold;
  const matches = [];
  let score = 0;

  const categories = [
    ["severe_slur", scores.severeSlur],
    ["moderate_slur", scores.moderateSlur],
    ["hate_phrase", scores.hatePhrase]
  ];

  for (const [category, categoryScore] of categories) {
    for (const signal of signals[category]) {
      if (!signal.expression.test(normalized)) continue;
      score += categoryScore;
      matches.push({ category, signal: signal.term });
    }
  }

  const reasons = [...new Set(matches.map((match) => match.category))];
  const action = score >= blockThreshold ? "block" : score >= flagThreshold ? "flag" : "allow";

  return {
    allowed: action !== "block",
    score,
    action,
    reasons,
    matches
  };
}

function moderateChatMessage(message) {
  if (!config.settings.chat.enabled) {
    return { allowed: true, score: 0, action: "allow", reasons: [], matches: [] };
  }
  return moderateText(message, config.settings.chat);
}

function moderateUsername(username) {
  if (!config.settings.usernames.enabled) {
    return { allowed: true, score: 0, action: "allow", reasons: [], matches: [] };
  }
  const threshold = config.settings.usernames.blockThreshold;
  return moderateText(username, { flagThreshold: threshold, blockThreshold: threshold });
}

module.exports = { normalizeText, moderateText, moderateChatMessage, moderateUsername };
