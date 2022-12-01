const express = require('express');
const bodyParser = require('body-parser');

const ds = require('./datastore');
const { OAUTH2CLIENT, CLIENT_ID, USERS, HIVES, QUEENS } = require('./constants');

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
function verifyJwt (req) {
    var idToken = '';
    if (req.headers.authorization !== undefined) {
        // remove the bearer suffix
        idToken = req.headers.authorization.substr(7);
    }

    verificationParams = {
        'idToken': idToken,
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
            throw new Error('Missing or invalid JWT');
        });
};

/**
 * Verify that the user is the beekeeper for the given hive.
 * Throws an error if the user does not match the hive's beekeeper.
 * Throws an error if the hive is not found.
 * Returns the hive if the beekeeper is valid.
 */
function verifyBeekeeper (beekeeperId, hiveId) {
    const hiveKey = datastore.key([HIVES, parseInt(hiveId, 10)]);

    return datastore.get(hiveKey)
        .then(hive => {
            if (hive[0] === undefined || hive[0] === null) {
                throw new Error('Hive and/or queen not found');
            } else if (hive[0].beekeeper !== beekeeperId) {
                throw new Error('Hive has a different owner');
            } else {
                return hive;
            }
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
// Model functions related to HIVE entities.
//----------------------------------------------------------------------------

/**
 * Function to create a new hive.
 * 
 * Schema: 
 *  hiveName (string): tag name for this beehive
 *  structureType (string): structure type of the beehive (e.g. 'long box')
 *  colonySize (int): approximate number of bees in the hive at last check
 *  beekeeper (string): the user ID for this hive's beekeeper (creator)
 *  queen (QUEEN): the hive's current queen (must be added by 
 *      PUT /hive/:hive_id/queen/:queen_id)
 * 
 * All string attributes must be alphanumeric.
 */
function createHive (req, hiveName, structureType, colonySize) {
    var newHiveKey = datastore.key(HIVES);
    const newHive = { 'hiveName': hiveName,
                        'structureType': structureType,
                        'colonySize': colonySize,
                        'queen': null
                    };
    const hive = { 'key': newHiveKey, 'data': newHive };
    
    // Verify the user
    return verifyJwt(req)
        .then(beekeeperId => {
            newHive.beekeeper = beekeeperId;
            // Verify hiveName and structureType before saving to datastore
            return verifyAttribute(hiveName);
        })
        .then(() => {
            verifyAttribute(structureType);
        })
        .then(() => {
            return datastore.save(hive);
        })
        .then(() => {
            const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + newHiveKey.id;
            return { 'id': newHiveKey.id, ...newHive, 'self': self };
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Retrieve all hives for the authenticated user. The results will be paginated to 
 * a size of 5, and include a link to the next 5 results. 
 */
function getHives (req) {
    var foundHives = {};
    var foundHivesInfo = {};
    var beekeeper = '';

    return verifyJwt(req)
        .then(beekeeperId => {
            beekeeper = beekeeperId;
            const allHivesQuery = datastore.createQuery(HIVES)
                .filter('beekeeper', '=', beekeeper);
            return datastore.runQuery(allHivesQuery);
        })
        .then(hives => {
            foundHives.total = hives[0].length;
            const paginHivesQuery = datastore.createQuery(HIVES).limit(5)
                .filter('beekeeper', '=', beekeeper);
            return datastore.runQuery(paginHivesQuery);
        })
        .then(hives => {
            foundHives.hives = hives[0]; // hive entities as a list
            foundHivesInfo = hives[1]; // query information
            foundHives.hives.map(ds.fromDatastore);
            
            // add a link to the next page of results if there are more results remaining
            if (foundHivesInfo.moreResults !== datastore.NO_MORE_RESULTS) {
                foundHives.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + foundHivesInfo.endCursor;
            }
            return foundHives;
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Retrieve the hive with the given ID.
 * If not found, throw an error.
 * Response includes the self link.
 */
function getHive (req, hiveId) {
    return verifyJwt(req)
        .then(beekeeperId => {
            return verifyBeekeeper(beekeeperId, hiveId);
        })
        .then(hive => {
            // Save self link and return object containining all hive data
            const hiveObj = hive.map(ds.fromDatastore)[0];
            const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + hiveObj.id;
            hiveObj.self = self;
            return hiveObj;
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Delete the hive with the given ID.
 * If not found, throw an error.
 */
function deleteHive (req, hiveId) {
    const hiveKey = datastore.key([HIVES, parseInt(hiveId, 10)]);

    return verifyJwt(req)
        .then(beekeeperId => {
            return verifyBeekeeper(beekeeperId, hiveId);
        })
        .then(hive => {
            if (hive[0] == null) {
                throw new Error('Hive and/or queen not found');
            } else {
                
                // remove association with a queen before deleting
                if (hive[0].queen != null) {
                    removeQueen(req, hiveId, hive[0].queen.id);
                }
                // delete the hive
                return datastore.delete(hiveKey);
            }
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Update all of the attributes of the hive with ID passed to updateHive.
 * 
 * The Queen attribute will not be updated. Updating a queen can be done 
 * through the route 'PUT /hives/:hive_id/queens/:queen_id'
 */
function putHive (req, hiveId, hiveName, structureType, colonySize) {
    const hiveKey = datastore.key([HIVES, parseInt(hiveId, 10)]);
    const newHive = { 'hiveName': hiveName,
                        'structureType': structureType,
                        'colonySize': colonySize
                    };

    return verifyJwt(req)
        .then(beekeeperId => {
            newHive.beekeeper = beekeeperId;
            return verifyBeekeeper(beekeeperId, hiveId);
        })
        .then(hive => {
            newHive.queen = hive[0].queen;
            // Verify hiveName and structureType before saving to datastore
            return verifyAttribute(hiveName);
        })
        .then(() => {
            return verifyAttribute(structureType);
        })
        .then(() => {
            return datastore.save({ 'key': hiveKey, 'data': newHive });
        })
        .then(() => {
            const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + hiveKey.id;
            return { 'id': hiveKey.id, ...newHive, 'self': self };
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Update any attributes of the hive with ID passed to updateHive.
 * 
 * The Queen attribute will not be updated. Assigning a queen can be done 
 * through the route 'PUT /hives/:hive_id/queens/:queen_id'
 */
function patchHive (req, hiveId, hiveName, structureType, colonySize) {  
    const hiveKey = datastore.key([HIVES, parseInt(hiveId, 10)]);
    var foundHive = {};

    return verifyJwt(req)
        .then(beekeeperId => {
            return verifyBeekeeper(beekeeperId, hiveId);
        })
        .then(hive => {
            // save hive data and verify hiveName input
            foundHive = hive.map(ds.fromDatastore)[0];
            if (hiveName != null) {
                foundHive.hiveName = hiveName;
                return verifyAttribute(hiveName);
            } else {
                return;
            }
        })
        .then(() => {
            // verify structureType input (if applicable)
            if (structureType != null) {
                foundHive.structureType = structureType;
                return verifyAttribute(structureType);
            } else {
                return;
            }
        })
        .then(() => {
            if (colonySize != null) {
                foundHive.colonySize = colonySize;
            }
            const data = { 'hiveName': foundHive.hiveName,
                            'structureType': foundHive.structureType,
                            'colonySize': foundHive.colonySize,
                            'beekeeper': foundHive.beekeeper,
                            'queen': foundHive.queen
            };
            return datastore.save({ 'key': hiveKey, 'data': data });
        })
        .then(() => {
            const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + hiveKey.id;
            foundHive.self = self;
            return foundHive;
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Update the hive with hive_id to contain the queen with queen_id.
 * The queen object with queen_id is updated to now operate in this hive.
 * Error is returned if the user is not authenticated, the hive is not
 * found, or the queen already has a hive.
 */
function assignQueen (req, hiveId, queenId) {
    const queenKey = datastore.key([QUEENS, parseInt(queenId, 10)]);
    var foundHive = {};

    return verifyJwt(req)
        .then(beekeeperId => {
            return verifyBeekeeper(beekeeperId, hiveId);
        })
        .then(hive => {
            foundHive = hive;
            return datastore.get(queenKey);
        })
        .then(queen => {
            // if hive with given ID not found, throw error
            if (queen[0] == null) {
                throw new Error('Hive and/or queen not found');
            } else if (queen[0].hive != null) {
                throw new Error('Queen is already assigned');
            } else {
                // update the found queen to show the found hive as its carrier
                const hiveSelf = req.protocol + '://' + req.get('host') + '/hives/' + hiveId;
                const hive = { 'id': hiveId, 'hiveName': foundHive[0].hiveName, 'self': hiveSelf };
                queen[0].hive = hive;
                return datastore.save(queen[0]);
            };
        })
        .then(() => {
        // Update the found hive to now have the queen assigned to it
            const queenSelf = req.protocol + '://' + req.get('host') + '/queens/' + queenKey.id;
            foundHive[0].queen = { 'id': String(queenKey.id), 'self': queenSelf };
            return datastore.save(foundHive[0]);
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Remove the queen with queen_id from the hive with hive_id.
 * Error is returned if the user is not authenticated, the hive is not
 * found, or the queen is not associated with this hive.
 */
function removeQueen (req, hiveId, queenId) {
    const queenKey = datastore.key([QUEENS, parseInt(queenId, 10)]);
    var foundHive = {};
    
    return verifyJwt(req)
        .then(beekeeperId => {
            return verifyBeekeeper(beekeeperId, hiveId);
        })
        .then(hive => {
            foundHive = hive;
            if (foundHive[0].queen == null || String(foundHive[0].queen.id) !== queenId) {
                throw new Error('Queen is not associated with this hive');
            } else {
                foundHive[0].queen = null;
                return datastore.get(queenKey);
            };
        })
        .then(queen => {
            if (queen[0] == null) { // queen not found
                throw new Error('Hive and/or queen not found');
            } else if (queen[0].hive == null) {
                throw new Error('Queen is not associated with this hive');
            } else if (queen[0].hive.id !== hiveId) {
                throw new Error('Queen is not associated with this hive');
            } else {
                // update the found queen to remove its hive (set to null)
                queen[0].hive = null;
                return datastore.save(queen[0]);
            };
        })
        .then(() => {
            // Save the hive entity with the updated queens array
            return datastore.save(foundHive[0]);
        })
        .catch(error => {
            throw error;
        })
};

//----------------------------------------------------------------------------
// Controller functions related to HIVE entities.
//----------------------------------------------------------------------------

/**
 * Handle POST requests to /hives to create a new hive. A new hive will not
 * be created if hiveName, structureType, or colonySize is missing from the request.
 */
router.post('/', function (req, res) {
    if (req.get('Content-Type') !== 'application/json') {
        res.status(415).json({ Error: 'Unsupported MIME type received - server can only accept application/json' });

    } else if (req.body.hiveName === undefined || req.body.structureType === undefined || req.body.colonySize === undefined) {
        res.status(400).json({ Error: 'The request object is missing at least one of the required attributes' });

    } else {
        createHive(req, req.body.hiveName, req.body.structureType, req.body.colonySize)
            .then(hive => {
                // req.accepts() returns content type if found, and False if none found
                // Source: https://www.tutorialspoint.com/express-js-req-accepts-method
                const accepts = req.accepts(['application/json']);
                if (!accepts) {
                    res.status(406).json({ Error: 'Unsupported MIME type requested - only application/json supported' });
                } else if (accepts === 'application/json') {
                    res.set('Content-Type', 'application/json');
                    res.status(201).json(hive);
                } else {
                    res.status(500).send('Unknown server error');
                }
            })
            .catch(error => {
                if (error.message === 'invalid characters') {
                    res.status(400).json({ Error: 'hiveName and structureType must include only alphanumeric characters' });
                } else if (error.message === 'Missing or invalid JWT') {
                    res.status(401).json({ Error: error.message });
                }
            });
    };
});

/**
 * Handle GET requests to /hives to get all hives. 5 hives will be listed per page, along
 * with a link to the next 5 hives, if any. Only those hives associated with the user will
 * be returned.
 */
router.get('/', function (req, res) {
    getHives(req)
        .then(hives => {    
            const accepts = req.accepts(['application/json']);        
            if (!accepts) {
                res.status(406).json({ Error: 'Unsupported MIME type requested - only application/json supported' });
            } else if (accepts === 'application/json') {
                res.set('Content-Type', 'application/json');
                res.status(200).json(hives);
            }
        })
        .catch(error => {
            if (error.message === 'Missing or invalid JWT') {
                res.status(401).json({ Error: error.message });
            }
        })
});

/**
 * Handle GET requests to /hives/:hive_id to get the hive with the given ID.
 * Response is a 404 error if no hive is found with given ID.
 */
router.get('/:hive_id', function (req, res) {
    getHive(req, req.params.hive_id)
        .then(hive => {
            // req.accepts() returns content type if found, and False if none found
            // Source: https://www.tutorialspoint.com/express-js-req-accepts-method
            const accepts = req.accepts(['application/json']);
            if (!accepts) {
                res.status(406).json({ Error: 'Unsupported MIME type requested - only application/json supported' });
            } else if (accepts === 'application/json') {
                res.set('Content-Type', 'application/json');
                res.status(200).json(hive);
            } else {
                res.status(500).json({ Error: 'Unknown server error' });
            };
        })
        .catch(error => {
            if (error.message === 'Missing or invalid JWT') {
                res.status(401).json({ Error: error.message });
            } else if (error.message === 'Hive has a different owner') {
                res.status(403).json({ Error: error.message });
            } else if (error.message === 'Hive and/or queen not found') {
                res.status(404).json({ Error: error.message });
            }
        });
});

/**
 * Handle DELETE requests to /hives/:hive_id to delete the hive with the given ID.
 * Response is a 404 error if no hive is found with given ID or the user
 * is not authenticated.
 */
router.delete('/:hive_id', function (req, res) {
    deleteHive(req, req.params.hive_id)
        .then(() => {
            res.status(204).end();
        })
        .catch(error => {
            if (error.message === 'Hive and/or queen not found') {
                res.status(404).json({ Error: error.message });
            } else if (error.message === 'Hive has a different owner') {
                res.status(403).json({ Error: error.message });
            } else if (error.message === 'Missing or invalid JWT') {
                res.status(401).json({ Error: error.message });
            }
        });
});

/**
 * Handle PUT requests to /hives/:hive_id to replace a hive's attributes. No changes will be
 * made if hiveName, structureType, or colonySize is missing from the request.
 */
router.put('/:hive_id', function (req, res) {
    if (req.get('Content-Type') !== 'application/json') {
        res.status(415).json({ Error: 'Unsupported MIME type received - server can only accept application/json' });
    
    } else if (req.body.hiveName === undefined || req.body.structureType === undefined || req.body.colonySize === undefined) {
        res.status(400).json({ Error: 'The request object is missing at least one of the required attributes' });

    } else {
        putHive(req, req.params.hive_id, req.body.hiveName, req.body.structureType, req.body.colonySize)
            .then(hive => {     
                const accepts = req.accepts(['application/json']);
                if (!accepts) {
                    res.status(406).json({ Error: 'Unsupported MIME type requested - only application/json supported' });
                } else if (accepts === 'application/json') {  
                    res.location(hive.self);
                    res.set('Content-Type', 'application/json');
                    res.status(303).json(hive);
                }
            })
            .catch(error => {
                if (error.message === 'invalid characters') {
                    res.status(400).json({ Error: 'hiveName and structureType must include only alphanumeric characters' });
                } else if (error.message === 'Missing or invalid JWT') {
                    res.status(401).json({ Error: error.message });
                } else if (error.message === 'Hive and/or queen not found') {
                    res.status(404).json({ Error: error.message });
                }
            });
    };
});

/**
 * Handle PATCH requests to /hives/:hive_id to update a hive. Allows for individual 
 * attributes to be changed on a hive entity.
 */
router.patch('/:hive_id', function (req, res) {
    if (req.get('Content-Type') !== 'application/json') {
        res.status(415).json({ Error: 'Unsupported MIME type received - server can only accept application/json' });
    } else {
        patchHive(req, req.params.hive_id, req.body.hiveName, req.body.structureType, req.body.colonySize)
            .then(hive => {
                const accepts = req.accepts(['application/json']);
                if (!accepts) {
                    res.status(406).json({ Error: 'Unsupported MIME type requested - only application/json supported' });
                } else if (accepts === 'application/json') {  
                    res.location(hive.self);
                    res.set('Content-Type', 'application/json');
                    res.status(200).json(hive);
                }
            })
            .catch(error => {
                if (error.message === 'invalid characters') {
                    res.status(400).json({ Error: 'hiveName and structureType must include only alphanumeric characters' });
                } else if (error.message === 'Missing or invalid JWT') {
                    res.status(401).json({ Error: error.message });
                } else if (error.message === 'Hive and/or queen not found') {
                    res.status(404).json({ Error: error.message });
                }
            });
    };
});

/**
 * Handle PUT requests to /hives/:hive_id/queens/:queen_id to assign a queen to 
 * a hive. No changes will be made if:
 *   - The user is not authenticated.
 *   - Either the hive or queen does not exist.
 *   - The queen is already living with another hive.
 */
router.put('/:hive_id/queens/:queen_id', function (req, res) {
    assignQueen(req, req.params.hive_id, req.params.queen_id)
        .then(() => {
            res.status(204).end();
        })
        .catch(error => {
            if (error.message === 'Hive and/or queen not found') {
                res.status(404).json({ Error: error.message });
            } else if (error.message === 'Queen is already assigned') {
                res.status(403).json({ Error: error.message });
            } else if (error.message === 'Missing or invalid JWT') {
                res.status(401).json({ Error: error.message });
            }
        });
});

/**
 * Handle DELETE requests to /hives/:hive_id/queens/:queen_id to remove a queen 
 * from a hive. The queen will not be deleted. No changes will be made if:
 *   - The user is not authenticated.
 *   - Either the hive or queen does not exist.
 *   - The queen is not living with this hive.
 */
router.delete('/:hive_id/queens/:queen_id', function (req, res) {
    removeQueen(req, req.params.hive_id, req.params.queen_id)
        .then(() => {
            res.status(204).end();
        })
        .catch(error => {
            if (error.message === 'Hive and/or queen not found') {
                res.status(404).json({ Error: error.message });
            } else if (error.message === 'Queen is not associated with this hive') {
                res.status(403).json({ Error: error.message });
            } else if (error.message === 'Missing or invalid JWT') {
                res.status(401).json({ Error: error.message });
            }
        });
});

//----------------------------------------------------------------------------
// WARNINGS for /hive route handlers
//----------------------------------------------------------------------------

/**
 * Warn that PUT requests to /hives are not supported.
 */
 router.put('/', function (req, res) {
    res.set('Accept', 'Get, Post');
    res.status(405).json({ Error: "Acceptable reqests to /hives: GET, POST" });
});

/**
 * Warn that DELETE requests to /hives are not supported.
 */
router.delete('/', function (req, res) {
    res.set('Accept', 'Get, Post');
    res.status(405).json({ Error: "Acceptable reqests to /hives: GET, POST" });
});

/**
 * Warn that PATCH requests to /hives are not supported.
 */
router.patch('/', function (req, res) {
    res.set('Accept', 'Get, Post');
    res.status(405).json({ Error: "Acceptable reqests to /hives: GET, POST" });
});

/**
 * Warn that POST requests to /hives/:hive_id are not supported.
 */
router.post('/:hive_id', function (req, res) {
    res.set('Accept', 'Get, Put, Delete, Patch');
    res.status(405).json({ Error: 'Acceptable reqests to /hives/:hive_id: GET, PUT, DELETE, PATCH' });
})

//----------------------------------------------------------------------------

module.exports = router;
