interface DesignSystemOptions {
  brandName: string;
  colorMode: string;
  colors: Array<{ name: string; hex: string; usage: string }>;
  displayFont: string;
  bodyFont: string;
  principles: string[];
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function generateDesignSystem(options: DesignSystemOptions): string {
  const colorTable = options.colors.map(c =>
    `| ${c.name} | \`${c.hex}\` | \`${hexToRgb(c.hex)}\` | ${c.usage} |`
  ).join('\n');

  const cssVars = options.colors.map(c =>
    `  --color-${c.name.toLowerCase().replace(/\s+/g, '-')}: ${c.hex};`
  ).join('\n');

  const principlesSection = options.principles.map(p =>
    `### ${p}\n\n(describe what this principle means in practice and how it affects design decisions)\n`
  ).join('\n');

  return `# ${options.brandName} - Design System

## Color Mode

${options.colorMode === 'both' ? 'Dark and light modes supported.' : options.colorMode === 'dark' ? 'Dark mode only.' : 'Light mode only.'}

## Color Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
${colorTable}

### CSS Custom Properties

\`\`\`css
:root {
${cssVars}
}
\`\`\`

## Typography

### Display / Headlines
**${options.displayFont}**

\`\`\`css
:root {
  --font-display: '${options.displayFont}', serif;
}
\`\`\`

### Body Text
**${options.bodyFont}**

\`\`\`css
:root {
  --font-body: '${options.bodyFont}', sans-serif;
}
\`\`\`

### Scale

| Level | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| h1 | 2.5rem | 700 | Display | Page titles |
| h2 | 2rem | 600 | Display | Section headers |
| h3 | 1.5rem | 600 | Display | Subsection headers |
| body | 1rem | 400 | Body | Paragraph text |
| small | 0.875rem | 400 | Body | Captions, metadata |

## Design Principles

${principlesSection}

## Component Patterns

### Buttons

\`\`\`css
.btn-primary {
  background: var(--color-${options.colors[1]?.name.toLowerCase().replace(/\s+/g, '-') || 'accent'});
  color: white;
  font-family: var(--font-body);
  padding: 0.75rem 1.5rem;
  border: none;
  cursor: pointer;
}
\`\`\`

### Cards

\`\`\`css
.card {
  background: var(--color-${options.colors[0]?.name.toLowerCase().replace(/\s+/g, '-') || 'background'});
  border: 1px solid var(--color-${options.colors[2]?.name.toLowerCase().replace(/\s+/g, '-') || 'border'});
  padding: 1.5rem;
}
\`\`\`

### Forms

\`\`\`css
.input {
  font-family: var(--font-body);
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-${options.colors[2]?.name.toLowerCase().replace(/\s+/g, '-') || 'border'});
  background: transparent;
}
\`\`\`

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| --space-xs | 0.25rem | Tight gaps |
| --space-sm | 0.5rem | Compact spacing |
| --space-md | 1rem | Default spacing |
| --space-lg | 1.5rem | Section padding |
| --space-xl | 2rem | Major sections |
| --space-2xl | 3rem | Page-level spacing |
`;
}
