import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const template = readFileSync('template.yaml', 'utf8');
const appBaseUrlParameter = template.match(
  /^ {2}AppBaseUrl:\n(?:^ {4}.+\n)+/m,
)?.[0];

describe('deployment configuration', () => {
  it('requires an explicit HTTPS application URL', () => {
    expect(appBaseUrlParameter).toContain('Type: String');
    expect(appBaseUrlParameter).toContain("AllowedPattern: '^https://");
    expect(appBaseUrlParameter).not.toContain('Default:');
  });

  it('configures the deployed CloudFront URL in samconfig', () => {
    const samconfig = readFileSync('samconfig.toml', 'utf8');

    expect(samconfig).toContain(
      'AppBaseUrl=https://d2jbn2huy2ajh.cloudfront.net',
    );
    expect(samconfig).not.toContain('dominio.com');
  });

  it('configures the local frontend URL for SAM local', () => {
    const localEnvironment = JSON.parse(
      readFileSync('env.local.json', 'utf8'),
    ) as { Parameters: Record<string, string> };

    expect(localEnvironment.Parameters.APP_BASE_URL).toBe(
      'http://localhost:5170',
    );
  });
});
