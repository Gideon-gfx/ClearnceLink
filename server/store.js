// Persistence for the API.
//  - With MONGODB_URI set: records live in MongoDB (one collection per data key, one document per record) and
//    uploaded files live in GridFS. The data is loaded into memory at startup and every change made through save()
//    is written back as per-document upserts/deletes.
//  - Without it: the original JSON file and upload folders are used, so local development keeps working.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'auth.json');
const uploadsDir = path.join(dataDir, 'uploads');
const registrationDir = path.join(dataDir, 'registration');
const DEFAULT_KEYS = ['users', 'resets', 'sessions'];
const ARRAY_KEYS = '__arrayKeys';

// Files written by earlier versions of the server sit on disk; both backends can still read them.
function readLegacyFile(id) {
  const direct = path.join(uploadsDir, id);
  if (fs.existsSync(direct)) return fs.readFileSync(direct);
  if (fs.existsSync(registrationDir)) {
    const match = fs.readdirSync(registrationDir).find((name) => name.startsWith(`${id}.`));
    if (match) return fs.readFileSync(path.join(registrationDir, match));
  }
  return null;
}

function fileStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  const data = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : {};
  for (const key of DEFAULT_KEYS) data[key] ||= [];
  const save = () => {
    const temporary = `${dataFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
    fs.renameSync(temporary, dataFile);
  };
  const files = {
    put: async (id, buffer) => { fs.writeFileSync(path.join(uploadsDir, id), buffer); },
    get: async (id) => readLegacyFile(id),
    remove: async (id) => { fs.rmSync(path.join(uploadsDir, id), { force: true }); },
  };
  return { backend: 'file', data, save, files, close: async () => {} };
}

async function mongoStore(uri) {
  const { MongoClient, GridFSBucket } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'clearancelink');
  const bucket = new GridFSBucket(db, { bucketName: 'files' });

  const files = {
    put: (id, buffer) => new Promise((resolve, reject) => {
      const stream = bucket.openUploadStreamWithId(id, id);
      stream.on('error', reject);
      stream.on('finish', resolve);
      stream.end(buffer);
    }),
    remove: async (id) => { await bucket.delete(id).catch(() => {}); },
    async get(id) {
      try {
        const chunks = [];
        for await (const chunk of bucket.openDownloadStream(id)) chunks.push(chunk);
        return Buffer.concat(chunks);
      } catch (error) {
        if (error.code === 'ENOENT' || /FileNotFound/i.test(error.message)) return readLegacyFile(id);
        throw error;
      }
    },
  };

  // Each record object keeps a stable Mongo _id for as long as it stays in memory.
  const identities = new WeakMap();
  const snapshots = {};            // collection -> Map(_id -> JSON last written)
  const metaSnapshot = new Map();  // non-array data keys -> JSON last written
  const data = {};

  const collectionNames = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((item) => item.name)
    .filter((name) => !name.startsWith('system.') && !name.startsWith('files.') && name !== '_meta');
  const metaDocs = await db.collection('_meta').find().toArray();

  if (!collectionNames.length && !metaDocs.length && fs.existsSync(dataFile)) {
    // First run against an empty database: move the existing JSON data and uploaded files across.
    Object.assign(data, JSON.parse(fs.readFileSync(dataFile, 'utf8')));
    console.log('MongoDB is empty: importing existing data from server/data/auth.json');
    for (const [folder, strip] of [[uploadsDir, false], [registrationDir, true]]) {
      if (!fs.existsSync(folder)) continue;
      for (const name of fs.readdirSync(folder)) {
        const id = strip ? name.replace(/\.[^.]+$/, '') : name;
        try { await files.put(id, fs.readFileSync(path.join(folder, name))); } catch (error) { console.error(`Could not import file ${name}:`, error.message); }
      }
    }
  } else {
    for (const name of collectionNames) {
      const documents = await db.collection(name).find().toArray();
      data[name] = documents.map(({ _id, ...record }) => { identities.set(record, _id); return record; });
      snapshots[name] = new Map(data[name].map((record) => [identities.get(record), JSON.stringify(record)]));
    }
    for (const item of metaDocs) {
      metaSnapshot.set(item._id, JSON.stringify(item.value));
      if (item._id === ARRAY_KEYS) { for (const key of item.value) data[key] ||= []; } // arrays that are currently empty
      else data[item._id] = item.value;
    }
  }
  for (const key of DEFAULT_KEYS) data[key] ||= [];

  async function flush() {
    // Empty arrays leave no documents behind, so remember which keys are arrays.
    const arrayKeys = Object.keys(data).filter((key) => Array.isArray(data[key])).sort();
    const arrayKeysJson = JSON.stringify(arrayKeys);
    if (metaSnapshot.get(ARRAY_KEYS) !== arrayKeysJson) {
      await db.collection('_meta').replaceOne({ _id: ARRAY_KEYS }, { value: arrayKeys }, { upsert: true });
      metaSnapshot.set(ARRAY_KEYS, arrayKeysJson);
    }
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (!Array.isArray(value)) {
        const json = JSON.stringify(value);
        if (metaSnapshot.get(key) !== json) {
          await db.collection('_meta').replaceOne({ _id: key }, { value }, { upsert: true });
          metaSnapshot.set(key, json);
        }
        continue;
      }
      const previous = snapshots[key] || new Map();
      const next = new Map();
      const operations = [];
      for (const record of value) {
        if (!record || typeof record !== 'object') continue;
        let id = identities.get(record);
        if (!id) { id = crypto.randomUUID(); identities.set(record, id); }
        if (next.has(id)) continue;
        const json = JSON.stringify(record);
        next.set(id, json);
        if (previous.get(id) !== json) operations.push({ replaceOne: { filter: { _id: id }, replacement: record, upsert: true } });
      }
      const removed = [...previous.keys()].filter((id) => !next.has(id));
      if (removed.length) operations.push({ deleteMany: { filter: { _id: { $in: removed } } } });
      for (let start = 0; start < operations.length; start += 500) {
        await db.collection(key).bulkWrite(operations.slice(start, start + 500), { ordered: false });
      }
      snapshots[key] = next;
    }
  }

  let timer = null;
  let running = Promise.resolve();
  const queueFlush = () => { running = running.then(flush).catch((error) => console.error('MongoDB save failed:', error.message)); return running; };
  const save = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; queueFlush(); }, 25);
  };
  const close = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    await queueFlush();
    await client.close();
  };

  await queueFlush(); // writes the imported data on first run; a no-op afterwards
  return { backend: 'mongodb', data, save, files, close };
}

async function openStore() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  const store = uri ? await mongoStore(uri) : fileStore();
  // With CLOUDINARY_URL set, new uploads go to Cloudinary (private); older files are still read from where they are.
  if (String(process.env.CLOUDINARY_URL || '').trim()) {
    store.files = require('./cloudFiles').withCloudinary(store.files);
    store.filesBackend = 'cloudinary';
  }
  return store;
}

module.exports = { openStore };
