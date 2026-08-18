import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, unknown>;
    responses: Record<string, unknown>;
    parameters: Record<string, unknown>;
  };
}

const spec = parse(
  readFileSync('docs/openapi.yaml', 'utf8'),
) as unknown as OpenApiSpec;

const template = readFileSync('template.yaml', 'utf8');

const routesFromTemplate = (): string[] => {
  const routes: string[] = [];
  const pattern = /Path:\s*(\S+)\s*\n\s*Method:\s*(\S+)/g;

  let match = pattern.exec(template);
  while (match) {
    routes.push(`${match[2].toUpperCase()} ${match[1]}`);
    match = pattern.exec(template);
  }

  return routes.sort();
};

const routesFromSpec = (): string[] =>
  Object.entries(spec.paths)
    .flatMap(([path, operations]) =>
      Object.keys(operations).map(
        (method) => `${method.toUpperCase()} ${path}`,
      ),
    )
    .sort();

describe('openapi document', () => {
  it('is a valid openapi 3 document', () => {
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBeTruthy();
    expect(spec.info.version).toBeTruthy();
  });

  it('points at the current deployed test environment', () => {
    expect(spec.servers[0].url).toBe(
      'https://t1nma1q8f3.execute-api.us-east-1.amazonaws.com/dev',
    );
  });

  it('documents every route exposed by the sam template', () => {
    expect(routesFromSpec()).toEqual(routesFromTemplate());
  });

  it('documents ten routes', () => {
    expect(routesFromTemplate()).toHaveLength(10);
  });

  it('documents the literal evidence alias from the challenge', () => {
    expect(routesFromTemplate()).toContain(
      'GET /api/solicitudes/{id}/evidencia.pdf',
    );
  });

  it('gives every operation a summary and responses', () => {
    for (const [path, operations] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        const typed = operation as {
          summary?: string;
          responses?: Record<string, unknown>;
          tags?: string[];
        };

        expect(typed.summary, `${method} ${path} summary`).toBeTruthy();
        expect(typed.tags, `${method} ${path} tags`).toBeTruthy();
        expect(
          Object.keys(typed.responses ?? {}).length,
          `${method} ${path} responses`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('documents the 500 response on every operation', () => {
    for (const [path, operations] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        const responses = (operation as { responses: Record<string, unknown> })
          .responses;

        expect(Object.keys(responses), `${method} ${path}`).toContain('500');
      }
    }
  });

  it('resolves every internal reference', () => {
    const raw = readFileSync('docs/openapi.yaml', 'utf8');
    const refs = [...raw.matchAll(/\$ref:\s*'#\/([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(refs.length).toBeGreaterThan(0);

    for (const ref of refs) {
      const path = ref.split('/');
      let node: unknown = spec;

      for (const segment of path) {
        node = (node as Record<string, unknown>)[segment];
      }

      expect(node, ref).toBeDefined();
    }
  });

  it('never documents an internal field as part of a response', () => {
    const raw = readFileSync('docs/openapi.yaml', 'utf8');
    const responsesSection = raw.slice(raw.indexOf('components:'));

    for (const forbidden of ['taskToken', 'otpHash', 'executionArn']) {
      const documentedAsProperty = new RegExp(`^\\s{8}${forbidden}:`, 'm');
      expect(responsesSection).not.toMatch(documentedAsProperty);
    }
  });
});
