const express = require('express');
const bodyParser = require('body-parser');

const ds = require('./datastore');
const datastore = ds.datastore;
const { OAUTH2CLIENT, USERS } = require('./constants');

const json2html = require('node-json2html');
const axios = require('axios');
const path = require('path');

const url = require('url');
const { userInfo } = require('os');

const router = express.Router();
router.use(bodyParser.json());


/**
 * Convert the object resObj to an HTML format and send the file in the response
 * with the given status code.
 */
function sendHTML(res, statusCode, idToken, resObj) {
    // Learned to use the json2html library based on examples from the json2html 
    // documentation.
    // https://json2html.com/docs/
    var template = [
        {'<>':'p','text':'Below is your profile information'},
        {'<>':'ul','html':[
            {'<>':'li','html':function(){return('Your given name is ' + this.givenName)}},
            {'<>':'li','html':function(){return('Your family name is ' + this.familyName)}},
            {'<>':'li','html':function(){return('Your new JWT: ' + idToken)}}
        ]}
    ];

    res.set('Content-Type', 'text/html');
    res.status(statusCode).send(json2html.render(resObj, template));
};

//----------------------------------------------------------------------------
// Model functions related to the welcome page.
//----------------------------------------------------------------------------

/**
 * Function to create a new user (beekeeper).
 * 
 * Schema: 
 *  firstName (string): first name of the user
 *  lastName (string): last name of the user
 *  userId (string): identification ID for the user (the sub field of the public_id)
 *  isBeekeper (boolean): identifies the user as a verified beekeeper (default true)
 *  hives (array): all hive entities currently managed by the beekeeper 
 */
function createUser (req, firstName, lastName, userId) {
    var newUserKey = datastore.key(USERS);
    const newUser = {'firstName': firstName,
                        'lastName': lastName,
                        'userId': userId,
                        'isBeekeeper': true,
                        'hives': [] 
                    };
    const user = { 'key': newUserKey, 'data': newUser };
    
    return datastore.save(user)
        .then(() => {
            const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + newUserKey.id;
            return { 'id': newUserKey.id, ...newUser, 'self': self };
        })
        .catch(error => {
            throw error;
        });
};


/**
 * Generate a URL to redirect the user to in order to request
 * permission to their Google account information.
 */
function getAuthorizationURL() {
    // URL created will request permission for user profile information
    const authorizationUrl = OAUTH2CLIENT.generateAuthUrl({
        "access_type": "online",
        "scope": "profile",
        "include_granted_scopes": true
    });

    return authorizationUrl;
};

/**
 * Send a POST request to the Google token authorization page
 * using the code recently received from the server 
 */
function getServerToken(req) {
    // Method for extracting the "code" parameter taken from the Google Identiy
    // guide for 'Using Oauth2.0 for Web Applications'
    // Available at: https://developers.google.com/identity/protocols/oauth2/web-server
    
    // Attempted to use the URL API to extract the "code" paramater, rather than the 
    // deprecated query method suggested by the Google API docs.
    // Available at: https://developer.mozilla.org/en-US/docs/Web/API/URL_API
    const returnedUrl = url.parse(req.url, true).query;
    
    return OAUTH2CLIENT.getToken(returnedUrl.code)
        .then(token => { // contains access token
            OAUTH2CLIENT.setCredentials( { token } );
            return token.tokens;
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Send a GET request to the Google People API to request
 * the names field.
 */
function getUserInfo(token) {
    const request = {
        "method": "get",
        "url": "https://people.googleapis.com/v1/people/me?personFields=names",
        "headers": { "Authorization": "Bearer " + token.access_token }
    };

    return axios(request)
        .then(response => {
            const names = response.data.names[0];
            return names;
        })
        .catch(error => {
            throw error;
        });
};

//----------------------------------------------------------------------------
// Controller functions related to authorization and
// authentication on the welcome page.
//----------------------------------------------------------------------------

/**
 * Display the index.html page.
 */
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './views/welcome.html'));
});

/**
 * Get the user information after verifying the state value and getting the
 * token from the server.
 */
router.get('/oauth', (req, res) => {
    var userToken = {};
    var idToken = '';
    var userData = {};
    
    getServerToken(req)
        .then(token => {
            userToken = token
            idToken = token.id_token;
            return getUserInfo(token);
        })
        .then(userInfo => {
            userData = userInfo;
            return createUser(req, userInfo)
        })
        .then(() => {
            sendHTML(res, 200, idToken, userData);
        })
        .catch(error => {
            res.status(500).json(error.message);
        })
});


/** 
 * Caught when the user presses the button on the welcome page. Directs
 * The user to a page that will ask for permission to access their Google
 * Account information.
 */
router.post('/', (req, res) => {
    const authorizationURL = getAuthorizationURL();
    
    // Store the Google authorizaiton URL in the response header.
    // The user will then be redirected to the Google authorization page.
    res.location(authorizationURL);
    res.status(303).end();
});


//----------------------------------------------------------------------------

module.exports = router;