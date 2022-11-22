const express = require('express');
const bodyParser = require('body-parser');

const ds = require('./datastore');
const { USERS } = require('./constants');

const router = express.Router();

const datastore = ds.datastore;

router.use(bodyParser.json());

//----------------------------------------------------------------------------
// Model functions related to USER entities.
//----------------------------------------------------------------------------

/**
 * Retrieve all users. The results will not be paginated.
 */
function getUsers (req) {
    const usersQuery = datastore.createQuery(USERS);
    
    var foundUsers = {};

    return datastore.runQuery(usersQuery)
        .then(users => {
            foundUsers.users = users[0]; // queen entities as a list
            foundUsers.users.map(ds.fromDatastore);

            return foundUsers;
        })
        .catch(error => {
            throw error;
        });
};

//----------------------------------------------------------------------------
// Controller functions related to USER entities.
//----------------------------------------------------------------------------

/**
 * Handle GET requests to /users to get all users.
 */
router.get('/', function (req, res) {
    getUsers(req)
        .then(users => {
            res.status(200).json(users);
        });
});

/**
 * Warn that PUT requests to /users are not supported.
 */
router.put('/', function (req, res) {
    res.set('Accept', 'Get');
    res.status(405).json({ Error: "Acceptable reqests to /users: GET" });
});

/**
 * Warn that PATCH requests to /users are not supported.
 */
router.patch('/', function (req, res) {
    res.set('Accept', 'Get');
    res.status(405).json({ Error: "Acceptable reqests to /users: GET" });
});

/**
 * Warn that delete requests to /users are not supported.
 */
router.delete('/', function (req, res) {
    res.set('Accept', 'Get');
    res.status(405).json({ Error: "Acceptable reqests to /users: GET" });
});

//----------------------------------------------------------------------------

module.exports = router;
