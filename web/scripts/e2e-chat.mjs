import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'KAVEH_E2E_USER_A_EMAIL',
  'KAVEH_E2E_USER_A_PASSWORD',
  'KAVEH_E2E_USER_B_EMAIL',
  'KAVEH_E2E_USER_B_PASSWORD',
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const userA = createClient(url, key, options);
const userB = createClient(url, key, options);
const anonymous = createClient(url, key, options);
const token = randomUUID();
let channel;

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`);
  assert.ok(data.user?.id, `${label} did not return a user id`);
  return data.user;
}

function timeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

try {
  const [a, b] = await Promise.all([
    signIn(userA, process.env.KAVEH_E2E_USER_A_EMAIL, process.env.KAVEH_E2E_USER_A_PASSWORD, 'Account A'),
    signIn(userB, process.env.KAVEH_E2E_USER_B_EMAIL, process.env.KAVEH_E2E_USER_B_PASSWORD, 'Account B'),
  ]);
  assert.notEqual(a.id, b.id, 'E2E accounts must be two distinct Supabase users');
  pass('two independent accounts authenticated');

  const { data: conversationId, error: createError } = await userA.rpc('create_direct_conversation', {
    p_other_user_id: b.id,
  });
  if (createError) throw new Error(`Direct conversation RPC failed: ${createError.message}`);
  assert.ok(typeof conversationId === 'string' && conversationId.length > 10, 'conversation RPC returned no UUID');
  const { data: membership, error: membershipError } = await userB
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', b.id)
    .maybeSingle();
  if (membershipError) throw new Error(`Account B membership query failed: ${membershipError.message}`);
  assert.ok(membership, 'Account B cannot see its own conversation membership');
  pass('private conversation created and visible to both members');

  let resolveRealtime;
  const realtimeMessage = new Promise((resolve) => { resolveRealtime = resolve; });
  let resolveSubscribed;
  let rejectSubscribed;
  const subscribed = new Promise((resolve, reject) => {
    resolveSubscribed = resolve;
    rejectSubscribed = reject;
  });
  channel = userB.channel(`e2e-chat-${token}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => resolveRealtime(payload.new))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') resolveSubscribed();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') rejectSubscribed(new Error(`Realtime subscription status: ${status}`));
    });
  await timeout(subscribed, 20000, 'Realtime subscription');

  const messageBody = `KAVEH-E2E-${token}`;
  const { data: sentMessage, error: sendError } = await userA
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: a.id, body: messageBody, format: 'plain' })
    .select('id,body')
    .single();
  if (sendError) throw new Error(`Message insert failed: ${sendError.message}`);
  assert.equal(sentMessage.body, messageBody);
  const event = await timeout(realtimeMessage, 20000, 'Realtime message delivery to Account B');
  assert.equal(event.id, sentMessage.id);
  assert.equal(event.body, messageBody);
  const { data: receivedMessage, error: receiveError } = await userB
    .from('messages')
    .select('id,body,sender_id')
    .eq('id', sentMessage.id)
    .single();
  if (receiveError) throw new Error(`Account B message read failed: ${receiveError.message}`);
  assert.equal(receivedMessage.sender_id, a.id);
  pass('message persisted and arrived over Realtime at the second account');

  const readAt = new Date().toISOString();
  const { error: readUpdateError } = await userB
    .from('conversation_members')
    .update({ last_read_at: readAt })
    .eq('conversation_id', conversationId)
    .eq('user_id', b.id);
  if (readUpdateError) throw new Error(`Read cursor update failed: ${readUpdateError.message}`);
  const { data: peerCursor, error: cursorReadError } = await userA
    .from('conversation_members')
    .select('last_read_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', b.id)
    .single();
  if (cursorReadError) throw new Error(`Read cursor visibility failed: ${cursorReadError.message}`);
  assert.ok(peerCursor.last_read_at, 'Account A did not observe Account B read cursor');
  pass('read cursor updated by Account B and visible to Account A');

  const fileBytes = Buffer.from(`Kaveh Avenger E2E attachment ${token}`, 'utf8');
  const objectPath = `${a.id}/${randomUUID()}`;
  const sha256 = createHash('sha256').update(fileBytes).digest('hex');
  const { error: uploadError } = await userA.storage.from('user-files').upload(objectPath, fileBytes, {
    contentType: 'text/plain',
    upsert: false,
  });
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data: asset, error: assetError } = await userA.from('file_assets').insert({
    owner_id: a.id,
    bucket_id: 'user-files',
    object_path: objectPath,
    original_name: `e2e-${token}.txt`,
    mime_type: 'text/plain',
    byte_size: fileBytes.length,
    sha256_hex: sha256,
    status: 'ready',
  }).select('id').single();
  if (assetError) throw new Error(`File metadata insert failed: ${assetError.message}`);

  const { data: fileMessage, error: fileMessageError } = await userA.from('messages').insert({
    conversation_id: conversationId,
    sender_id: a.id,
    body: `📎 e2e-${token}.txt`,
    format: 'plain',
  }).select('id').single();
  if (fileMessageError) throw new Error(`Attachment message insert failed: ${fileMessageError.message}`);

  const { error: attachmentError } = await userA.from('message_attachments').insert({
    message_id: fileMessage.id,
    file_asset_id: asset.id,
    display_order: 0,
  });
  if (attachmentError) throw new Error(`Message attachment link failed: ${attachmentError.message}`);

  const { data: sharedAsset, error: sharedAssetError } = await userB
    .from('file_assets')
    .select('id,object_path,sha256_hex')
    .eq('id', asset.id)
    .single();
  if (sharedAssetError) throw new Error(`Account B cannot read shared file metadata: ${sharedAssetError.message}`);
  assert.equal(sharedAsset.sha256_hex, sha256);

  const { data: downloaded, error: downloadError } = await userB.storage.from('user-files').download(objectPath);
  if (downloadError || !downloaded) throw new Error(`Account B file download failed: ${downloadError?.message ?? 'empty response'}`);
  const downloadedBytes = Buffer.from(await downloaded.arrayBuffer());
  assert.deepEqual(downloadedBytes, fileBytes, 'downloaded file bytes differ from uploaded bytes');
  pass('private file uploaded, shared with conversation member, downloaded and SHA-256 verified');

  const { data: anonymousAsset, error: anonymousMetadataError } = await anonymous
    .from('file_assets')
    .select('id')
    .eq('id', asset.id)
    .maybeSingle();
  assert.ok(anonymousMetadataError || !anonymousAsset, 'anonymous client unexpectedly read private file metadata');
  const { data: anonymousFile, error: anonymousFileError } = await anonymous.storage.from('user-files').download(objectPath);
  assert.ok(anonymousFileError || !anonymousFile, 'anonymous client unexpectedly downloaded a private file');
  pass('anonymous client denied access to private file metadata and object');

  console.log(`E2E PASS: conversation=${conversationId}; message=${sentMessage.id}; attachment=${asset.id}`);
  console.log('Note: test records are intentionally retained for audit; this script does not delete production data.');
} finally {
  if (channel) await userB.removeChannel(channel);
  await Promise.allSettled([userA.auth.signOut(), userB.auth.signOut()]);
}
