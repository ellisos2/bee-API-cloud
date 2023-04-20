const { google } = require('googleapis');
const dotenv = require('dotenv');
dotenv.config();

const DOMAIN = 'https://portfolio-ellisos2-370318.uk.r.appspot.com';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URL = 'https://portfolio-ellisos2-370318.uk.r.appspot.com/oauth';
const OAUTH2CLIENT = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URL
);

module.exports = {
    USERS: 'Users',
    BEEKEEPERS: 'Beekeepers',
    QUEENS: 'Queens',
    HIVES: 'Hives',
    DOMAIN,
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URL,
    OAUTH2CLIENT
};