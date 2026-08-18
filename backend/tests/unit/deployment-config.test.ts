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

  it('does not pin an application URL in samconfig', () => {
    const samconfig = readFileSync('samconfig.toml', 'utf8');

    expect(samconfig).not.toContain('AppBaseUrl=');
    expect(samconfig).not.toContain('cloudfront.net');
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
