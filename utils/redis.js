import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
        this.client = createClient();

        this.client.on('error', (err) => {
            console.error('Redis client could not be connected to server: ', err);
        });
    }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    const getAsync = promisify(this.client.get).bind(this.client);
    return getAsync(key);
  }

  async set(key, value, durationInSeconds) {
    this.client.setex(key, durationInSeconds, value);
  }

  async del(key) {
    this.client.del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
