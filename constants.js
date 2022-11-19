const { google } = require('googleapis');

const DOMAIN = 'http://localhost:8080';
const CLIENT_ID = '591778857481-rdimi6ttmk0f93qjb7ua3e8hmngvsair.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URL = 'http://localhost:8080/oauth';
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

// module.exports.OAUTH2CLIENT = new google.auth.OAuth2(
//     CLIENT_ID = '1002940455399-emdumsqonctdqsl7255martr49jkku77.apps.googleusercontent.com',
//     CLIENT_SECRET = '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',
//     REDIRECT_URL = 'https://hw7-ellisos2.uk.r.appspot.com/oauth'
// );

