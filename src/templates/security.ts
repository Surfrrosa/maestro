import type { ProjectType } from './claude-md.js';

export function generateSecurityChecklist(projectType: ProjectType): string {
  const common = `## General

- [ ] No secrets committed to version control
- [ ] .env files are gitignored (except .env.example)
- [ ] Dependencies audited for known vulnerabilities
- [ ] Dependency versions pinned (no floating versions)
- [ ] Error messages do not expose internal details to users
`;

  const web = `## Web Security

- [ ] Content Security Policy (CSP) headers configured
- [ ] CORS restricted to allowed origins
- [ ] Rate limiting on public endpoints
- [ ] Input sanitization on all user inputs
- [ ] XSS prevention (output encoding)
- [ ] CSRF protection enabled
- [ ] HTTPS enforced in production
- [ ] Secure cookie flags set (HttpOnly, Secure, SameSite)

### CSP Domains

| Service | Domains | Directives |
|---------|---------|------------|
| (add as you integrate services) | | |
`;

  const api = `## API Security

- [ ] Authentication on all protected endpoints
- [ ] Rate limiting configured
- [ ] Input validation on all request bodies
- [ ] SQL injection prevention (parameterized queries or ORM)
- [ ] Request size limits configured
- [ ] CORS restricted to allowed origins
- [ ] API keys rotated on schedule
- [ ] Logging does not capture sensitive data
`;

  const mobile = `## Mobile Security

- [ ] API keys not hardcoded in app bundle
- [ ] Certificate pinning configured
- [ ] Sensitive data in secure storage (Keychain/Keystore)
- [ ] Deep link validation
- [ ] Biometric/PIN protection for sensitive actions
- [ ] App transport security configured
- [ ] No sensitive data in app logs
`;

  const sections = [`# Security Checklist\n`, common];

  if (['api-python', 'api-node'].includes(projectType)) {
    sections.push(api);
  }
  if (['frontend-next', 'frontend-static', 'api-python', 'api-node'].includes(projectType)) {
    sections.push(web);
  }
  if (projectType === 'mobile-react-native') {
    sections.push(mobile);
  }

  sections.push(`## Audit Log

| Date | Action | Result |
|------|--------|--------|
| | Initial security review | |
`);

  return sections.join('\n');
}
