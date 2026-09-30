// Stores uploaded files (logos, student documents, stamps, ID cards) in Cloudinary as private files. They are never
// public: the server downloads them with a short-lived signed link, after it has checked the caller's permission.
// Files saved before Cloudinary was connected stay where they are and are still served from there.
const cloudinary = require('cloudinary').v2; // picks up CLOUDINARY_URL from the environment

const PREFIX = 'clearancelink';
const OPTIONS = { resource_type: 'raw', type: 'private' };
const publicId = (id) => `${PREFIX}/${id}`;

function withCloudinary(base) {
  return {
    async put(id, buffer) {
      try {
        await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({ public_id: publicId(id), overwrite: true, ...OPTIONS }, (error, result) => (error ? reject(error) : resolve(result))).end(buffer);
        });
      } catch (error) {
        // Never lose an upload because the cloud is unreachable: keep it in the normal store instead.
        console.error('Cloudinary upload failed, saving to the built-in store instead:', error.message || error);
        await base.put(id, buffer);
      }
    },
    async get(id) {
      const local = await base.get(id); // files from before Cloudinary, or ones saved by the fallback above
      if (local) return local;
      try {
        const link = cloudinary.utils.private_download_url(publicId(id), '', { ...OPTIONS, expires_at: Math.floor(Date.now() / 1000) + 300 });
        const response = await fetch(link, { signal: AbortSignal.timeout(20000) });
        if (response.ok) return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        console.error('Cloudinary download failed:', error.message || error);
      }
      return null;
    },
    async remove(id) {
      try { await cloudinary.uploader.destroy(publicId(id), OPTIONS); } catch (error) { console.error('Cloudinary delete failed:', error.message || error); }
      if (base.remove) await base.remove(id);
    },
  };
}

module.exports = { withCloudinary };
