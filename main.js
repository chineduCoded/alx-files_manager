import dbClient from './utils/db';

const waitConnection = async () => {
  let i = 0;
  while (!(await dbClient.isAlive()) && i < 10) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    i += 1;
  }
  if (!(await dbClient.isAlive())) {
    throw new Error('Failed to establish a connection to the database');
  }
};

(async () => {
  console.log(await dbClient.isAlive());

  try {
    await waitConnection();
    console.log(await dbClient.isAlive());
    console.log(await dbClient.nbUsers());
    console.log(await dbClient.nbFiles());
  } catch (error) {
    console.error(error.message);
  }
})();
