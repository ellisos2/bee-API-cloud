const express = require('express');
const bodyParser = require('body-parser');

const ds = require('./datastore');
const { OAUTH2CLIENT, CLIENT_ID, USERS, QUEENS } = require('./constants');

const router = express.Router();

const datastore = ds.datastore;

router.use(bodyParser.json());

//----------------------------------------------------------------------------
// Authentication and verificiation functions used to authenticate users 
// and validate request input.
//----------------------------------------------------------------------------

/**
 * Use the Google API to verify the JWT of the request.
 * Structure and code based on the example from the 
 * 'Authenticate with a backend server' guide at
 * https://developers.google.com/identity/sign-in/web/backend-auth
 */
 function verifyJwt (token) {
    verificationParams = {
        'idToken': token,
        'audience': CLIENT_ID
    };

    return OAUTH2CLIENT.verifyIdToken(verificationParams)
        .then(ticket => {
            return ticket.getPayload(); 
        })
        .then(payload => {
            return payload['sub'];
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Verify that the attribute uses only spaces and alphanumeric characters.
 * Will not be used to validate date attributes.
 * 
 * Returns nothing if no errors are present, and throws an error if 
 * non-alphanumeric characters are found.
 */
function verifyAttribute (attribute) {
    // Information about Regular Expressions learned through trial and error
    // based on the 'Regular Expressions Quick Start' Guide.
    // from: https://www.regular-expressions.info/quickstart.html
    const valid = /^[a-zA-Z0-9 ]+$/;

    if (!valid.test(attribute)) {
        throw new Error('invalid characters');
    } else {
        return;
    }
};

//----------------------------------------------------------------------------
// Model functions related to queen entities.
//----------------------------------------------------------------------------

/**
 * Function to create a new queen.
 * 
 * Schema: 
 *  name (string): the queen bee's name
 *  species (string): bee species of the queen
 *  age (int): approximate age (in months)
 *  hive (object): the queen's current hive (must be added by 
 *      PUT /hive/:hive_id/queen/:queen_id)
 * 
 * All string attributes must be alphanumeric.
 */
function createQueen (req, name, species, age) {
    var newQueenKey = datastore.key(QUEENS);
    const newQueen = { 'name': name,
                        'species': species,
                        'age': age,
                        'hive': null
                    };
    const queen = { 'key': newQueenKey, 'data': newQueen };

    return verifyAttribute(name)
        .then(() => {
            verifyAttribute(species);
        })
        .then(() => {
            return datastore.save(queen)
        })
        .then(() => {
            const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + newQueenKey.id;
            return { 'id': newQueenKey.id, ...newQueen, 'self': self };
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Retrieve all queens. The results will be paginated to a size of 5, and a link to the
 * next 5 results. 
 */
function getQueens (req) {
    const allQueensQuery = datastore.createQuery(QUEENS);
    const paginQueensQuery = datastore.createQuery(QUEENS).limit(5);

    var foundQueens = {};
    var foundQueensInfo = {};

    return datastore.runQuery(allQueensQuery)
        .then(queens => {
            foundQueens.total = queens[0].length();
            return datastore.runQuery(paginQueensQuery)
        })
        .then(queens => {
            foundQueens.queens = queens[0]; // queen entities as a list
            foundQueensInfo = queens[1]; // query information
            foundQueens.queens.map(ds.fromDatastore);
            
            // add a link to the next page of results if there are more results remaining
            if (foundQueensInfo.moreResults !== datastore.NO_MORE_RESULTS) {
                foundQueens.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + foundQueensInfo.endCursor;
            }
            return foundQueens;
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Retrieve the queen with the given ID.
 * If not found, throw an error.
 * Response includes the self link.
 */
function getQueen (req, queenId) {
    const queenKey = datastore.key([QUEENS, parseInt(queenId, 10)]);

    return datastore.get(queenKey)
        .then(queen => {
            // Do nothing if the queen is not found. 
            if (queen[0] === undefined || queen[0] === null) {
                throw new Error('Queen not found');
            } else {
                // Save self link and return object containining all queen data
                const queenObj = queen.map(ds.fromDatastore)[0];
                const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + queenObj.id;
                queenObj.self = self;
                return queenObj;
            };
        });
};

/**
 * Delete the Queen with the given ID.
 * If not found, throw an error.
 */
function deleteQueen (req, queenId) {
    const queenKey = datastore.key([QUEENS, parseInt(queenId, 10)]);

    return datastore.get(queenKey)
        .then(queen => {
            if (queen[0] == null) {
                throw new Error('Queen not found');
            } else {
                // delete the queen
                return datastore.delete(queenKey);
            }
        })
        .catch(error => {
            throw new Error(error.message);
        });
};

/**
 * Update all of the attributes of the queen with ID passed to updateQueen.
 * 
 * The Queen attribute will not be updated. Updating a queen can be done 
 * through the route 'PUT /queens/:queen_id/queens/:queen_id'
 */
function putQueen (req, queenId, name, species, age) {
    const queenKey = datastore.key([QUEENS, parseInt(queenId, 10)]);
    const newQueen = { 'name': name,
                        'species': species,
                        'age': age
                    };

    // Verify name and species before saving to datastore
    return verifyAttribute(name)
        .then(() => {
            verifyAttribute(species);
        })
        .then(() => {
            return datastore.save({ 'key': queenKey, 'data': newQueen });
        })
        .then(() => {
            const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + queenKey.id;
            return { 'id': queenKey.id, ...newQueen, 'self': self };
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Update any attributes of the queen with ID passed to updateQueen.
 * 
 * The Queen attribute will not be updated. Updating a queen can be done 
 * through the route 'PUT /queens/:queen_id/queens/:queen_id'
 */
function patchQueen (req, queenId, name, species, age) {
    const queenKey = datastore.key([QUEENS, parseInt(queenId, 10)]);
    var foundQueen = {};

    return datastore.get(queenKey)
        .then(queen => {
            // save queen data and verify name input
            foundQueen = queen.map(ds.fromDatastore)[0];
            if (name != null) {
                foundQueen.name = name;
                return verifyAttribute(name);
            } else {
                return;
            }
        })
        .then(() => {
            // verify species input (if applicable)
            if (species != null) {
                foundQueen.species = species;
                return verifyAttribute(species);
            } else {
                return;
            }
        })
        .then(() => {
            const data = { 'name': foundQueen.name,
                            'species': foundQueen.species,
                            'age': foundQueen.age
                        };
            return datastore.save({ 'key': queenKey, 'data': data });
        })
        .then(() => {
            const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + queenKey.id;
            foundQueen.self = self;
            return foundQueen;
        })
        .catch(error => {
            throw error;
        });
};

//----------------------------------------------------------------------------
// Controller functions related to QUEEN entities.
//----------------------------------------------------------------------------

/**
 * Handle POST requests to /queens to create a new queen. A new queen will not
 * be created if name, species, or age is missing from the request.
 */
router.post('/', function (req, res) {
    if (req.get('Content-Type') !== 'application/json') {
        res.status(415).json({ Error: 'Unsupported MIME type received - server can only accept application/json' });

    } else if (req.body.name === undefined || req.body.species === undefined || req.body.age === undefined) {
        res.status(400).json({ Error: 'The request object is missing at least one of the required attributes' });

    } else {
        createQueen(req, req.body.name, req.body.species, req.body.age)
            .then(queen => {
                // req.accepts() returns content type if found, and False if none found
                // Source: https://www.tutorialspoint.com/express-js-req-accepts-method
                const accepts = req.accepts(['application/json']);
                if (!accepts) {
                    res.status(406).json({ Error: 'Unsupported MIME type requested - only application/json supported' });
                } else if (accepts === 'application/json') {
                    res.set('Content-Type', 'application/json');
                    res.status(201).json(queen);
                } else {
                    res.status(500).send('Unknown server error');
                }
            })
            .catch(error => {
                if (error.message === 'invalid characters') {
                    res.status(400).json({ Error: 'Name and species must include only alphanumeric characters' });
                } else if (error.message === 'Missing or invalid JWT') {
                    res.status(401).json({ Error: error.message });
                } else {
                    res.status(404).json({ Error: error.message });
                }
            });
    };
});

/**
 * Handle GET requests to /queens to get all queens. 5 queens will be listed per page, along
 * with a link to the next 5 queens, if any.
 */
router.get('/', function (req, res) {
    getQueens(req)
        .then(queens => {
            res.status(200).json(queens);
        });
});

/**
 * Handle GET requests to /queens/:queen_id to get the queen with the given ID.
 * Response is a 404 error if no queen is found with given ID.
 */
router.get('/:queen_id', function (req, res) {
    getQueen(req, req.params.queen_id)
        .then(queen => {
            // req.accepts() returns content type if found, and False if none found
            // Source: https://www.tutorialspoint.com/express-js-req-accepts-method
            const accepts = req.accepts(['application/json', 'text/html']);
            
            // determine the appropriate MIME type to send based on the request
            if (!accepts) {
                res.status(406).json({ Error: 'Unsupported MIME type requested - only application/json supported' });
            } else if (accepts === 'application/json') {
                res.set('Content-Type', 'application/json');
                res.status(200).json(queen);
            } else {
                res.status(500).json({ Error: 'Unknown server error' })
            };
        })
        .catch(error => {
            res.status(404).json({ Error: 'No queen with this queen_id exists' });
        });
});

/**
 * Handle DELETE requests to /queens/:queen_id to delete the queen with the given ID.
 * Response is a 404 error if no queen is found with given ID or the user
 * is not authenticated.
 */
router.delete('/:queen_id', function (req, res) {
    deleteQueen(req, req.params.queen_id)
        .then(() => {
            res.status(204).end();
        })
        .catch(error => {
            res.status(404).json({ Error: 'No queen with this queen_id exists' });
        });
});

/**
 * Handle PUT requests to /queens/:queen_id to replace a queen's attributes. No changes will be
 * made if name, species, or age is missing from the request.
 */
router.put('/:queen_id', function (req, res) {
    if (req.get('Content-Type') !== 'application/json') {
        res.status(415).json({ Error: 'Unsupported MIME type received - server can only accept application/json' });
    
    } else if (req.body.name === undefined || req.body.species === undefined || req.body.age === undefined) {
        res.status(400).json({ Error: 'The request object is missing at least one of the required attributes' });
    
    } else {
        putQueen(req, req.params.queen_id, req.body.name, req.body.species, req.body.age)
            .then(queen => {            
                res.location(queen.self);
                res.set('Content-Type', 'application/json');
                res.status(303).json(queen);
            })
            .catch(error => {
                if (error.message === 'invalid characters') {
                    res.status(400).json({ Error: 'Name and species must include only alphanumeric characters' });
                } else {
                    res.status(404).json({ Error: 'No queen with this queen_id exists' });
                }
            });
    };
});

/**
 * Handle PATCH requests to /queens/:queen_id to update a queen. Allows for individual 
 * attributes to be changed on a queen entity.
 */
router.patch('/:queen_id', function (req, res) {
    if (req.get('Content-Type') !== 'application/json') {
        res.status(415).json({ Error: 'Unsupported MIME type received - server can only accept application/json' });
    } else {
        patchQueen(req, req.params.queen_id, req.body.name, req.body.species, req.body.age)
            .then(queen => {
                res.set('Content-Type', 'application/json');
                res.status(200).json(queen);
            })
            .catch(error => {
                if (error.message === 'invalid characters') {
                    res.status(400).json({ Error: 'Name and species must include only alphanumeric characters' });
                } else {
                    res.status(404).json({ Error: 'No queen with this queen_id exists' });
                }
            });
    };
});

//----------------------------------------------------------------------------
// WARNINGS for /queen route handlers
//----------------------------------------------------------------------------

/**
 * Warn that PUT requests to /queens are not supported.
 */
 router.put('/', function (req, res) {
    res.set('Accept', 'Get, Post');
    res.status(405).json({ Error: "Acceptable reqests to /queens: GET, POST" });
});

/**
 * Warn that DELETE requests to /queens are not supported.
 */
router.delete('/', function (req, res) {
    res.set('Accept', 'Get, Post');
    res.status(405).json({ Error: "Acceptable reqests to /queens: GET, POST" });
});

/**
 * Warn that PATCH requests to /queens are not supported.
 */
router.patch('/', function (req, res) {
    res.set('Accept', 'Get, Post');
    res.status(405).json({ Error: "Acceptable reqests to /queens: GET, POST" });
});

/**
 * Warn that POST requests to /queens/:queen_id are not supported.
 */
router.post('/:queen_id', function (req, res) {
    res.set('Accept', 'Get, Put, Delete, Patch');
    res.status(405).json({ Error: 'Acceptable reqests to /queens/:queen_id: GET, PUT, DELETE, PATCH' });
})

//----------------------------------------------------------------------------

module.exports = router;
