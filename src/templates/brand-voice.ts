interface VoiceOptions {
  audience: string;
  toneAdjectives: string[];
  soundsLike: string;
  doesNotSoundLike: string;
  bannedPhrases: string[];
  formattingRules: string[];
  frameworks: string;
}

function generateToneSection(options: VoiceOptions): string {
  const toneItems = options.toneAdjectives.map(adj =>
    `- **${adj}**: (describe what this means in practice -- what you DO and DON'T say)`
  ).join('\n');

  return `## Audience

${options.audience}

## Voice Description

**Sounds like:** ${options.soundsLike}

**Does NOT sound like:** ${options.doesNotSoundLike}

## Tone Attributes

${toneItems}`;
}

function generateHardRulesSection(options: VoiceOptions): string {
  const rulesSection = options.formattingRules.map(rule =>
    `- ${rule}`
  ).join('\n');

  const bannedTable = options.bannedPhrases.map(phrase =>
    `| ${phrase} | (why it's banned) | (what to say instead) |`
  ).join('\n');

  return `## Hard Rules

${rulesSection}

## Banned Phrases

| Phrase | Reason | Use Instead |
|--------|--------|-------------|
${bannedTable}`;
}

function generateFrameworkSection(options: VoiceOptions): string {
  if (!options.frameworks) return '';

  return `## Intellectual Foundations

${options.frameworks}

These frameworks inform the substance of what we write. Reference them internally but don't lecture about them.
`;
}

export function generateBrandVoice(options: VoiceOptions): string {
  return `# Brand Voice

${generateToneSection(options)}

${generateHardRulesSection(options)}

${generateFrameworkSection(options)}## Context-Specific Guidance

### Website Copy
(how the voice adapts for website pages)

### Blog Posts
(how the voice adapts for long-form content)

### Social Media
(how the voice adapts for short-form posts)

### Email
(how the voice adapts for direct communication)

## Review Checklist

Before publishing any content, verify:

- [ ] Tone matches the attributes above
- [ ] No banned phrases present
- [ ] All formatting rules followed
- [ ] Voice is consistent with existing published content
- [ ] Content serves the audience defined above
`;
}
