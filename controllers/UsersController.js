import bcrypt from 'bcrypt';
import { ObjectID } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');
const SALT_ROUNDS = 10;

class UsersController {
  static async postNew(request, response) {
    const { email } = request.body;
    const { password } = request.body;

    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }

    const users = dbClient.db.collection('users');
    try {
      const existingUser = await users.findOne({ email });
      if (existingUser) {
        response.status(400).json({ error: 'Already exist' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await users.insertOne(
        {
          email,
          password: hashedPassword,
        },
      );

      response.status(201).json({ id: result.insertedId, email });
      userQueue.add({ userId: result.insertedId });

    } catch (error) {
      console.error('Error in postNew:', error);
      response.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getMe(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId) {
      const users = dbClient.db.collection('users');
      const idObject = new ObjectID(userId);
      users.findOne({ _id: idObject }, (err, user) => {
        if (user) {
          response.status(200).json({ id: userId, email: user.email });
        } else {
          response.status(401).json({ error: 'Unauthorized' });
        }
      });
    } else {
      console.log('Hupatikani!');
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
}

module.exports = UsersController;
