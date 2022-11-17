const express = require('express');
const app = express();

app.use('/', require('./index'));

app.enable('trust proxy');

// Default listen on port 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on: ${PORT}`);
});
