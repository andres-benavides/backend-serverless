const path = require('node:path');
const { createConfig } = require('../../webpack.shared.cjs');

module.exports = createConfig({
  name: 'approver',
  port: Number(process.env.PORT ?? 5172),
  appDir: __dirname,
  exposes: {
    './ApproverApp': path.resolve(__dirname, 'src/ApproverApp.tsx'),
    './MailboxApp': path.resolve(__dirname, 'src/MailboxApp.tsx'),
  },
});
