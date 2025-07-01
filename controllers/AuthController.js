import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(request, response) {
    const authHeader = request.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    if (!email || !password) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const users = dbClient.db.collection('users');
    try {
      const user = await users.findOne({ email });
      if (!user) {
        response.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (passwordMatch) {
        const token = uuidv4();
        const key = `auth_${token}`;
        await redisClient.set(key, user._id.toString(), 24 * 60 * 60); // 24 hours
        response.status(200).json({ token });
      } else {
        response.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      console.error('Error in getConnect:', error);
      response.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getDisconnect(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const id = await redisClient.get(key);
    if (id) {
      await redisClient.del(key);
      response.status(204).json({});
    } else {
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
}

module.exports = AuthController;
