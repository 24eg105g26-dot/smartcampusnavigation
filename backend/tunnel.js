const localtunnel = require('localtunnel');

(async () => {
  try {
    const port = process.env.PORT || 3000;
    const tunnel = await localtunnel({ port: Number(port) });

    console.log('=======================================================');
    console.log(' PUBLIC DEPLOYMENT LINK ACTIVE:');
    console.log(' ' + tunnel.url);
    console.log('=======================================================');

    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Failed to create tunnel:', err);
  }
})();
