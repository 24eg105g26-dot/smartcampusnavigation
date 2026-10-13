const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// API routes
app.use('/api', apiRoutes);

// Fallback route for SPA
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Campus Navigation System Server Running`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` API Docs:  http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
});
