const { startServer } = require('directus');

// On Ionos Web Hosting, Passenger expects the app to start on a specific port 
// or it handles the server lifecycle automatically.
// Directus startServer() handles everything.
startServer();
