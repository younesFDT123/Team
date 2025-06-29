const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('I am alive!');
});

app.listen(3000, () => {
  console.log('Keep-alive Server läuft!');
});
