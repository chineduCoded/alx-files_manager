import express from "express";
import helmet from "helmet"; // Import helmet
import router from "./routes/index";

const app = express();

// Use helmet to set various security headers
app.use(helmet());

const port = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' })); // Added limit for base64 uploads if they are large
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

