let husky;

try {
  husky = (await import('husky')).default;
} catch {
  husky = null;
}

if (husky) {
  husky();
}
