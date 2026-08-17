const path = require('node:path');
const { createConfig } = require('../../webpack.shared.cjs');

module.exports = createConfig({
  name: 'requester',
  port: Number(process.env.PORT ?? 5171),
  appDir: __dirname,
  publicPath: process.env.PUBLIC_PATH ?? 'auto',
  exposes: {
    './RequesterApp': path.resolve(__dirname, 'src/RequesterApp.tsx'),
  },
});
