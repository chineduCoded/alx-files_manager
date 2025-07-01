import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { ObjectID } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

class FilesController {
  static async getUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId) {
      const users = dbClient.db.collection('users');
      const idObject = new ObjectID(userId);
      const user = await users.findOne({ _id: idObject });
      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  }

  static async postUpload(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { name } = request.body;
    const { type } = request.body;
    const { parentId } = request.body;
    const isPublic = request.body.isPublic || false;
    const { data } = request.body; // base64 encoded data

    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }
    const validTypes = ['folder', 'file', 'image'];
    if (!type || !validTypes.includes(type)) {
      return response.status(400).json({ error: 'Missing or invalid type' });
    }
    if (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Missing data' });
    }

    let buff;
    if (type === 'image') {
      try {
        buff = Buffer.from(data, 'base64');
        // Basic magic byte checks for common image types
        const magic = buff.toString('hex', 0, 4);
        const isPNG = magic === '89504e47';
        const isJPEG = buff.toString('hex', 0, 2) === 'ffd8';
        const isGIF = magic.substring(0, 3) === '474946'; // 'GIF'

        if (!isPNG && !isJPEG && !isGIF) {
          return response.status(400).json({ error: 'Invalid image data: Not a recognized image type (PNG, JPEG, GIF)' });
        }
      } catch (e) {
        return response.status(400).json({ error: 'Invalid base64 data for image' });
      }
    } else if (type === 'file') {
      try {
        buff = Buffer.from(data, 'base64');
      } catch (e) {
        return response.status(400).json({ error: 'Invalid base64 data for file' });
      }
    }


    const filesCollection = dbClient.db.collection('files');
    try {
      if (parentId) {
        const parentIdObject = new ObjectID(parentId);
        const parentFile = await filesCollection.findOne({ _id: parentIdObject, userId: user._id });
        if (!parentFile) {
          return response.status(400).json({ error: 'Parent not found' });
        }
        if (parentFile.type !== 'folder') {
          return response.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      const newFileDoc = {
        userId: user._id,
        name,
        type,
        isPublic,
        parentId: parentId ? new ObjectID(parentId) : 0,
      };

      if (type === 'folder') {
        const result = await filesCollection.insertOne(newFileDoc);
        return response.status(201).json({ id: result.insertedId, ...newFileDoc });
      }

      // For 'file' or 'image'
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const localFileName = uuidv4();
      const localPath = `${folderPath}/${localFileName}`;

      try {
        await fs.mkdir(folderPath, { recursive: true }); // recursive: true creates parent dirs if needed
      } catch (mkdirError) {
        // This might happen if path is a file, or permissions issue.
        // If it's just that dir exists, writeFile will proceed.
        // More robust check might be fs.stat and then mkdir.
        // For now, if mkdir fails fatally, writeFile will also likely fail.
      }

      await fs.writeFile(localPath, buff); // buff is already prepared
      newFileDoc.localPath = localPath;

      const result = await filesCollection.insertOne(newFileDoc);
      const responseData = { id: result.insertedId, ...newFileDoc };
      delete responseData.localPath; // Don't send localPath in response

      if (type === 'image') {
        fileQueue.add({ userId: user._id, fileId: result.insertedId });
      }
      return response.status(201).json(responseData);

    } catch (error) {
      console.error('Error in postUpload:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getShow(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const fileId = request.params.id;
    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(fileId);
    const file = await files.findOne({ _id: idObject, userId: user._id });
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.status(200).json(file);
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const {
      parentId,
      page,
    } = request.query;
    const pageNum = page || 0;
    const files = dbClient.db.collection('files');
    let query;
    if (!parentId) {
      query = { userId: user._id };
    } else {
      query = { userId: user._id, parentId: ObjectID(parentId) };
    }
    files.aggregate(
      [
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageNum, 10) } }],
            data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
          },
        },
      ],
    ).toArray((err, result) => {
      if (result) {
        const final = result[0].data.map((file) => {
          const tmpFile = {
            ...file,
            id: file._id,
          };
          delete tmpFile._id;
          delete tmpFile.localPath;
          return tmpFile;
        });
        // console.log(final);
        return response.status(200).json(final);
      }
      console.log('Error occured');
      return response.status(404).json({ error: 'Not found' });
    });
    return null;
  }

  static async putPublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const filesCollection = dbClient.db.collection('files');
    const fileIdObject = new ObjectID(id);

    try {
      const result = await filesCollection.findOneAndUpdate(
        { _id: fileIdObject, userId: user._id },
        { $set: { isPublic: true } },
        { returnOriginal: false } // Deprecated: use returnDocument: 'after' in newer driver versions
      );

      if (!result.value) { // If file not found or not updated
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(result.value);
    } catch (error) {
      console.error('Error in putPublish:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }

  static async putUnpublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const filesCollection = dbClient.db.collection('files');
    const fileIdObject = new ObjectID(id);

    try {
      const result = await filesCollection.findOneAndUpdate(
        { _id: fileIdObject, userId: user._id },
        { $set: { isPublic: false } },
        { returnOriginal: false } // Deprecated: use returnDocument: 'after'
      );

      if (!result.value) { // If file not found or not updated
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(result.value);
    } catch (error) {
      console.error('Error in putUnpublish:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getFile(request, response) {
    const { id } = request.params;
    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(id);
    files.findOne({ _id: idObject }, async (err, file) => {
      if (err || !file) {
        return response.status(404).json({ error: 'Not found' });
      }

      if (file.type === 'folder') {
        return response.status(400).json({ error: "A folder doesn't have content" });
      }

      // Authorization check: Public files or owned files
      if (!file.isPublic) {
        const user = await FilesController.getUser(request);
        if (!user || file.userId.toString() !== user._id.toString()) {
          return response.status(404).json({ error: 'Not found' });
        }
      }

      // At this point, user is authorized to access the file, or file is public.
      // Validate 'size' parameter
      let effectiveLocalPath = file.localPath;
      const requestedSize = request.query.size; // Use request.query
      const validSizes = ['100', '250', '500'];

      if (requestedSize) {
        if (!validSizes.includes(requestedSize)) {
          return response.status(400).json({ error: 'Invalid size parameter' });
        }
        // Only apply size to image types, and ensure it's for the original file path
        if (file.type === 'image') {
            effectiveLocalPath = `${file.localPath}_${requestedSize}`;
        } else {
            // If size is requested for a non-image, could be an error or serve original
            // For now, let's ignore size for non-images if requested, and serve original.
            // Or return bad request if size is specified for non-image:
            return response.status(400).json({ error: 'Size parameter only applicable to images' });
        }
      }

      try {
        const fileData = await fs.readFile(effectiveLocalPath);
        const responseContentType = mime.contentType(file.name) || 'application/octet-stream';

        response.setHeader('Content-Type', responseContentType);
        // For non-image types, set Content-Disposition to attachment.
        if (file.type !== 'image') {
          response.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
        }

        return response.status(200).send(fileData);
      } catch (error) {
        // console.error('File system error in getFile:', error); // Log for server
        return response.status(404).json({ error: 'Not found' }); // e.g. thumbnail doesn't exist
      }
    });
  }
}

module.exports = FilesController;
