import redisClient from './utils/redis';

(async () => {
    console.log(redisClient.isAlive()); // Wait for isAlive() to complete
    console.log(await redisClient.get('myKey'));
    await redisClient.set('myKey', 12, 5);
    console.log(await redisClient.get('myKey'));

    setTimeout(async () => {
        console.log(await redisClient.get('myKey'));
    }, 1000 * 10);
})();
