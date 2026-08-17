const { createConfig } = require('../../webpack.shared.cjs');

const remoteUrl = (name, port) =>
  `${name}@${process.env[`${name.toUpperCase()}_REMOTE_URL`] ?? `http://localhost:${port}`}/remoteEntry.js`;

module.exports = createConfig({
  name: 'shell',
  port: Number(process.env.PORT ?? 5170),
  appDir: __dirname,
  publicPath: process.env.PUBLIC_PATH ?? '/',
  remotes: {
    requester: remoteUrl('requester', 5171),
    approver: remoteUrl('approver', 5172),
  },
});
