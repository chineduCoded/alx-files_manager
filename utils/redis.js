import { createClient } from "redis";
import { promisify } from "util"

// class to define methods for commonly used redis command
class RedisClient {
    constructor() {
        this.client = createClient();
        this.isClientConnectd = true;
        this.client.on('error', (err) => {
            console.error('Redis client could not be connected to server: ', err.message || err.toString());
            this.isClientConnectd = false;
        });
        this.client.on('connect', () => {
            this.isClientConnectd = true;
        });
    }

    // check connection status and report
    isAlive() {
        return this.isClientConnectd;
    }

    // get value for given key from redis server
    async get(key) {
        const redisGet = promisify(this.client.get).bind(this.client);
        const value = await redisGet(key);
        return value;
    }

    // set key value pair to redis server
    async set(key, value, time) {
        const redisSet = promisify(this.client.set).bind(this.client);
        await redisSet(key, value);
        await this.client.expire(key, time);
    }

    // del key value pair from redis server
    async del(key) {
        const redisDel = promisify(this.client.del).bind(this.client);
        await redisDel(key);
    }
}

export const redisClient = new RedisClient();

export default redisClient;
