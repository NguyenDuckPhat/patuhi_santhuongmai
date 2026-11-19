// Test suite for message recall feature
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

let baseUrl;
let server;
let memberToken, adminToken, otherToken;
let conversationId;
let textMessageId, imageMessageId;

const request = async (method, urlPath, body = null, token = null, isForm = false) => {
  const url = `${baseUrl}${urlPath}`;
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = isForm ? body : JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
};

(async () => {
  // Start server (reuse logic from test-api.js)
  const http = require('http');
  const app = require('../src/app');
  const { testAndConnectDB } = require('../src/config/database');
  const initModels = require('../src/models');
  const seedData = require('../src/utils/seedData');
  const ensureProductMetadataColumns = require('../src/utils/ensureProductMetadataColumns');

  const sequelize = await testAndConnectDB();
  const models = initModels(sequelize);
  await sequelize.sync({ force: false });
  await ensureProductMetadataColumns(sequelize);
  await seedData();

  server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }));

  // Register three users: member (sender), other member, admin
  const rand = Date.now();
  const memberRes = await request('POST', '/api/auth/register', { username: `m_${rand}`, email: `m_${rand}@mail.com`, password: 'Pass123@', full_name: 'Member', phone: '0900' });
  memberToken = memberRes.data.data.token;
  const otherRes = await request('POST', '/api/auth/register', { username: `o_${rand}`, email: `o_${rand}@mail.com`, password: 'Pass123@', full_name: 'Other', phone: '0900' });
  otherToken = otherRes.data.data.token;
  const adminLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'Admin123@password' });
  adminToken = adminLogin.data.data.token;

  // Create conversation between member and admin (buyer/seller IDs)
  const convRes = await request('POST', '/api/chat/conversations', { buyer_id: memberRes.data.data.user.id, seller_id: adminLogin.data.data.user.id }, memberToken);
  conversationId = convRes.data.data.conversation.id;

  // Send a text message
  const textRes = await request('POST', `/api/chat/conversations/${conversationId}/messages`, { content: 'Hello recall', type: 'text' }, memberToken);
  textMessageId = textRes.data.data.message.id;

  // Send an image message
  const form = new FormData();
  form.append('content', 'Image message');
  form.append('type', 'image');
  form.append('file', fs.createReadStream(path.join(__dirname, 'sample.jpg')));
  const imgRes = await request('POST', `/api/chat/conversations/${conversationId}/messages`, form, memberToken, true);
  imageMessageId = imgRes.data.data.message.id;

  // Helper for recall
  const recall = async (msgId, token) => await request('POST', `/api/chat/conversations/${conversationId}/messages/${msgId}/recall`, null, token);

  // 1. Sender recalls text message
  const recallText = await recall(textMessageId, memberToken);
  console.log('Recall text status', recallText.status);

  // 2. Sender recalls image message and file is deleted
  const recallImg = await recall(imageMessageId, memberToken);
  console.log('Recall image status', recallImg.status);

  // 3. Admin recalls a new message from other user (should succeed)
  const otherMsg = await request('POST', `/api/chat/conversations/${conversationId}/messages`, { content: 'Other msg', type: 'text' }, otherToken);
  const adminRecall = await recall(otherMsg.data.data.message.id, adminToken);
  console.log('Admin recall status', adminRecall.status);

  // 4. Other member tries to recall admin's message (should 403)
  const otherRecall = await recall(otherMsg.data.data.message.id, otherToken);
  console.log('Other recall status', otherRecall.status);

  // 5. Duplicate recall should return 400
  const dup = await recall(textMessageId, memberToken);
  console.log('Duplicate recall status', dup.status);

  server.close();
})();
