const { google } = require('googleapis');

const DOMAIN = 'https://portfolio-ellisos2.uk.r.appspot.com';
const CLIENT_ID = '829321060518-07dcgkh1to4341mrv1ooqmo682mf6t7h.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URL = 'https://portfolio-ellisos2.uk.r.appspot.com/oauth';
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