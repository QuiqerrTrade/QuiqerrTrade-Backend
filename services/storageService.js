const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class StorageService {
  /**
   * Upload audio file to IPFS via Pinata
   */
  async uploadToIPFS(filePath, metadata) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      // Upload file
      const fileResponse = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            pinata_api_key: process.env.PINATA_API_KEY,
            pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
          },
        }
      );

      const fileHash = fileResponse.data.IpfsHash;
      const fileUrl = `https://gateway.pinata.cloud/ipfs/${fileHash}`;

      // Upload metadata JSON
      const metadataResponse = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          ...metadata,
          audio: fileUrl,
        },
        {
          headers: {
            pinata_api_key: process.env.PINATA_API_KEY,
            pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
          },
        }
      );

      const metadataHash = metadataResponse.data.IpfsHash;

      return {
        audioUrl: fileUrl,
        metadataUri: `https://gateway.pinata.cloud/ipfs/${metadataHash}`,
        fileHash,
        metadataHash,
      };
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw error;
    }
  }

  /**
   * Generate metadata JSON for a track/remix
   */
  generateMetadata(data) {
    return {
      name: data.title,
      description: data.description,
      image: data.coverImageUrl || 'https://default-cover.jpg',
      attributes: [
        { trait_type: 'Genre', value: data.genre },
        { trait_type: 'Type', value: data.type },
        { trait_type: 'Creator', value: data.creator },
        ...(data.bpm ? [{ trait_type: 'BPM', value: data.bpm }] : []),
        ...(data.key ? [{ trait_type: 'Key', value: data.key }] : []),
      ],
    };
  }
}

module.exports = new StorageService();