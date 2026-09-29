require('dotenv').config();
const { app, initializeDatabase } = require('./app');

const port = process.env.PORT || 3000;

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
