import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    this.client = new MongoClient(`mongodb://${host}:${port}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    this.client.connect().catch((err) => {
      console.error('DB Connection Error:', err);
    });
  }

  async isAlive() {
    try {
      // Attempt to ping the server to check if the connection is alive
      await this.client.db().admin().ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  async nbUsers() {
    if (!(await this.isAlive())) return 0;

    const db = this.client.db();
    const usersCollection = db.collection('users');
    const count = await usersCollection.countDocuments();

    return count;
  }

  async nbFiles() {
    if (!(await this.isAlive())) return 0;

    const db = this.client.db();
    const filesCollection = db.collection('files');
    const count = await filesCollection.countDocuments();

    return count;
  }
}

const dbClient = new DBClient();

export default dbClient;
