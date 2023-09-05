import express from "express"
import router from "./routes/index";

const app = express();

const port = process.env.PORT || 5000;

app.use(express.json());
app.use("/", router);

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${port} is already in use. Retrying in 5 seconds...`);
    setTimeout(() => {
      server.close();
      server.listen(port);
    }, 5000);
  }
});

