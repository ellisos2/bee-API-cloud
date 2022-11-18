const express = require('express');
const bodyParser = require('body-parser');

const ds = require('./datastore');
const { USERS, HIVES } = require('./constants');

const router = express.Router();

const datastore = ds.datastore;

router.use(bodyParser.json());

//----------------------------------------------------------------------------
// Verificiation functions used to validate request input.
//----------------------------------------------------------------------------

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
 *  queen (QUEEN): the hive's current queen (must be added by 
 *      PUT /hive/:hive_id/queen/:queen_id)
 * 
 * All string attributes must be alphanumeric.
 */
function createHive (req, hiveName, structureType, colonySize) {
    var newHiveKey = datastore.key(HIVES);
    const newHive = { 'hiveName': hiveName,
                        'structureType': type,
                        'colonySize': colonySize,
                        'queen': {}
                    };
    const hive = { 'key': newHiveKey, 'data': newHive };
    
    // Verify hiveName and structureType before saving to datastore
    return verifyAttribute(hiveName)
        .then(() => {
            verifyAttribute(structureType);
        })
        .then(() => {
            return datastore.save(hive)
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
 * Retrieve all hives. The results will be paginated to a size of 5, and a link to the
 * next 5 results. 
 */
function getHives (req) {
    const allHivesQuery = datastore.createQuery(HIVES);
    const paginHivesQuery = datastore.createQuery(HIVES).limit(5);

    var foundHives = {};
    var foundHivesInfo = {};

    return datastore.runQuery(allHivesQuery)
        .then(hives => {
            foundHives.total = hives[0].length();
            return datastore.runQuery(paginHivesQuery)
        })
        .then(hives => {
            foundHives.hives = hives[0]; // boat entities as a list
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
    const hiveKey = datastore.key([HIVES, parseInt(hiveId, 10)]);

    return datastore.get(hiveKey)
        .then(hive => {
            // Do nothing if the hive is not found. 
            if (hive[0] === undefined || hive[0] === null) {
                throw new Error('hive not found');
            } else {
                // Save self link and return object containining all hive data
                const hiveObj = boat.map(ds.fromDatastore)[0];
                const self = req.protocol + '://' + req.get('host') + req.baseUrl + '/' + hiveObj.hiveId;
                hiveObj.self = self;
                return hiveObj;
            };
        });
};

/**
 * Delete the hive with the given ID.
 * If not found, throw an error.
 */
function deleteHive (req, hiveId) {
    const hiveKey = datastore.key([HIVES, parseInt(hiveId, 10)]);

    return datastore.get(hiveKey)
        .then(hive => {
            if (hive[0] == null) {
                throw new Error('Hive not found');
            } else {
                // delete the hive
                return datastore.delete(hiveKey);
            }
        })
        .catch(error => {
            throw new Error(error.message);
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

    // Verify hiveName and structureType before saving to datastore
    return verifyAttribute(hiveName)
        .then(() => {
            verifyAttribute(structureType);
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
 * Update any attributes of the hive with ID passed to updateBoat.
 * 
 * The Queen attribute will not be updated. Updating a queen can be done 
 * through the route 'PUT /hives/:hive_id/queens/:queen_id'
 */
function patchHive (req, hiveId, hiveName, structureType, colonySize) {
    const hiveKey = datastore.key([HIVES, parseInt(hiveId, 10)]);
    var foundHive = {};

    return datastore.get(hiveKey)
        .then(hive => {
            // save hive data and verify hiveName input
            foundHive = hive.map(ds.fromDatastore)[0];
            if (hiveName != null) {
                foundBoat.hiveName = hiveName;
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
            const data = { 'hiveName': foundHive.hiveName,
                            'structureType': foundHive.structureType,
                            'colonySize': foundHive.colonySize
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
        createBoat(req, req.body.hiveName, req.body.structureType, req.body.colonySize)
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
                } else {
                    res.status(404).json({ Error: error.message });
                }
            });
    };
});

/**
 * Handle GET requests to /hives to get all hives. 5 hives will be listed per page, along
 * with a link to the next 5 hives, if any.
 */
router.get('/', function (req, res) {
    getHives(req)
        .then(hives => {
            res.status(200).json(hives);
        });
});

/**
 * Handle GET requests to /hives/:hive_id to get the hive with the given ID.
 * Response is a 404 error if no hive is found with given ID.
 */
router.get('/:hive_id', function (req, res) {
    getBoat(req, req.params.hive_id)
        .then(boat => {
            // req.accepts() returns content type if found, and False if none found
            // Source: https://www.tutorialspoint.com/express-js-req-accepts-method
            const accepts = req.accepts(['application/json', 'text/html']);
            
            // determine the appropriate MIME type to send based on the request
            if (!accepts) {
                res.status(406).json({ Error: 'Unsupported MIME type requested - only application/json supported' });
            } else if (accepts === 'application/json') {
                res.set('Content-Type', 'application/json');
                res.status(200).json(boat);
            } else {
                res.status(500).json({ Error: 'Unknown server error' })
            };
        })
        .catch(error => {
            res.status(404).json({ Error: 'No boat with this boat_id exists' });
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
            res.status(404).json({ Error: 'No hive with this hive_id exists' });
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
                res.location(hive.self);
                res.set('Content-Type', 'application/json');
                res.status(303).json(hive);
            })
            .catch(error => {
                if (error.message === 'invalid characters') {
                    res.status(400).json({ Error: 'hiveName and structureType must include only alphanumeric characters' });
                } else {
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
                res.set('Content-Type', 'application/json');
                res.status(200).json(hive);
            })
            .catch(error => {
                if (error.message === 'invalid characters') {
                    res.status(400).json({ Error: 'hiveName and structureType must include only alphanumeric characters' });
                } else {
                    res.status(404).json({ Error: error.message });
                }
            });
    };
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
