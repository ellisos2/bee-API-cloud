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
function createHive (req, hiveName, structureType, colonySize, ) {
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

    var totalHives = 0;
    var foundHives = {};
    var foundHivesInfo = {};

    return datastore.runQuery(allHivesQuery)
        .then(hives => {
            totalHives = hives[0].length();
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
 * Retrieve the boat with the given ID.
 * If not found, throw an error.
 * Response includes the self link.
 */
function getBoat (req, id) {
    const boatKey = datastore.key([BOATS, parseInt(id, 10)]);

    return datastore.get(boatKey)
        .then((boat) => {
            // Do nothing if the boat is not found. 
            if (boat[0] === undefined || boat[0] === null) {
                throw new Error("Boat not found");
            } else {
                // Save self link and return object containining all boat data
                const boatRes = boat.map(ds.fromDatastore)[0];
                const self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + boatRes.id;
                boatRes.self = self;
                return boatRes;
            };
        });
};

/**
 * Delete the boat with the given ID.
 * If not found, throw an error.
 */
function deleteBoat (req, boatId) {
    const boatKey = datastore.key([BOATS, parseInt(boatId, 10)]);

    return datastore.get(boatKey)
        .then((boat) => {
            if (boat[0] == null) {
                throw new Error("Boat not found")
            } else {
                // delete the boat
                return datastore.delete(boatKey);
            }
        })
        .catch((error) => {
            throw new Error(error.message);
        });
};

/**
 * Update all of the attributes of the boat with ID passed to updateBoat.
 */
function putBoat (req, id, name, type, length) {
    const boatKey = datastore.key([BOATS, parseInt(id, 10)]);
    const boat = { "name": name, "type": type, "length": length };

    // Verify name, type, and length before saving to datastore
    return verifyName(name)
        .then(() => {
            verifyType(type);
        })
        .then(() => {
            verifyLength(length);
        })
        .then(() => {
            return datastore.save({ "key": boatKey, "data": boat });
        })
        .then(() => {
            const self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + boatKey.id;
            return { "id": boatKey.id, ...boat, "self": self };
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Update any attributes of the boat with ID passed to updateBoat.
 */
function patchBoat (req, id, name, type, length) {
    const boatKey = datastore.key([BOATS, parseInt(id, 10)]);
    var foundBoat = {};

    return datastore.get(boatKey)
        .then((boat) => {
            // save boat data and verify name input
            foundBoat = boat.map(ds.fromDatastore)[0];
            if (name != null) {
                foundBoat.name = name;
                return verifyName(name);
            } else {
                return;
            }  
        })
        .then(() => {
            // verify type input (if applicable)
            if (type != null) {
                foundBoat.type = type;
                return verifyType(type);
            } else {
                return;
            }
        })
        .then(() => {
            // verify length input (if applicable)
            if (length != null) {
                foundBoat.length = length;
                return verifyLength(length);
            } else {
                return;
            }
        })
        .then(() => {
            const data = { "name": foundBoat.name, "type": foundBoat.type, "length": foundBoat.length }
            return datastore.save({ "key": boatKey, "data": data });
        })
        .then(() => {
            const self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + boatKey.id;
            foundBoat.self = self;
            return foundBoat;
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

    } else if (req.body.hiveName === undefined ||
                req.body.structureType === undefined ||
                req.body.colonySize === undefined) {
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
                if (error.message === "invalid characters") {
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
 * Handle GET requests to /boats/:boat_id to get the boat with the given ID.
 * Response is a 404 error if no boat is found with given ID.
 */
router.get('/:boat_id', function (req, res) {
    getBoat(req, req.params.boat_id)
        .then(boat => {
            // req.accepts() returns content type if found, and False if none found
            // Source: https://www.tutorialspoint.com/express-js-req-accepts-method
            const accepts = req.accepts(["application/json", "text/html"]);
            
            // determine the appropriate MIME type to send based on the request
            if (!accepts) {
                res.status(406).json({ Error: "Unsupported MIME type requested - only application/json and text/html supported" });
            } else if (accepts === "application/json") {
                res.set("Content-Type", "application/json");
                res.status(200).json(boat);
            } else if (accepts === "text/html") {
                sendHTML(res, 200, boat);
            } else {
                res.status(500).json({ Error: "Unknown server error" })
            };
        })
        .catch(error => {
            res.status(404).json({ Error: 'No boat with this boat_id exists' });
        });
});

/**
 * Handle DELETE requests to /boats/:boat_id to delete the boat with the given ID.
 * Response is a 404 error if no boat is found with given ID.
 */
router.delete('/:boat_id', function (req, res) {
    deleteBoat(req, req.params.boat_id)
        .then(() => {
            res.status(204).end();
        })
        .catch(error => {
            res.status(404).json({ Error: 'No boat with this boat_id exists' });
        });
});

/**
 * Handle PUT requests to /boats/:boat_id to replace a boat's attributes. No changes will be
 * made if name, type, or length is missing from the request.
 */
router.put('/:boat_id', function (req, res) {
    if (req.get("Content-Type") !== "application/json") {
        res.status(415).json({ Error: "Unsupported MIME type received - server can only accept application/json" });
    
    } else if (req.body.name === undefined || req.body.type === undefined || req.body.length === undefined) {
        res.status(400).json({ Error: 'The request object is missing at least one of the required attributes' });
    
    } else {
        putBoat(req, req.params.boat_id, req.body.name, req.body.type, req.body.length)
            .then(boat => {            
                res.location(boat.self);
                res.set("Content-Type", "application/json");
                res.status(303).json(boat);
            })
            .catch(error => {
                if (error.message === "name already in use") {
                    res.status(403).json({ Error: "That boat name is already in use" });
                } else if (error.message === "name/type too long") {
                    res.status(400).json({ Error: "That boat name or type is too long (must be =< 50 characters)" });
                } else if (error.message === "invalid characters") {
                    res.status(400).json({ Error: "name and type must include only alphanumeric characters and length must be a positive integer" })
                } else if (error.message === "length out of bounds") {
                    res.status(400).json({ Error: "length must be an integer value in the interval [0, 100,000]" });
                } else {
                    res.status(500).json({ Error: "Unknown server error" });
                }
            });
    };
});

/**
 * Handle PATCH requests to /boats/:boat_id to update a boat. Allows for individual 
 * attributes to be changed on a boat entity.
 */
router.patch('/:boat_id', function (req, res) {
    if (req.get("Content-Type") !== "application/json") {
        res.status(415).json({ Error: "Unsupported MIME type received - server can only accept application/json" });
    } else {
        patchBoat(req, req.params.boat_id, req.body.name, req.body.type, req.body.length)
        .then(boat => {
            res.set("Content-Type", "application/json");
            res.status(200).json(boat);
        })
        .catch(error => {
            if (error.message === "name already in use") {
                res.status(403).json({ Error: "That boat name is already in use" });
            } else if (error.message === "name/type too long") {
                res.status(400).json({ Error: "That boat name or type is too long (must be =< 50 characters)" });
            } else if (error.message === "invalid characters") {
                res.status(400).json({ Error: "name and type must include only alphanumeric characters and length must be a positive integer" })
            } else if (error.message === "length out of bounds") {
                res.status(400).json({ Error: "length must be an integer value in the interval [0, 100,000]" });
            } else {
                res.status(500).json({ Error: "Unknown server error" });
            }
        });
    };
});

/**
 * Warn that POST requests to /boats/:boat_id are not supported.
 */
router.post('/:boat_id', function (req, res) {
    res.set('Accept', 'Get, Put, Delete, Patch');
    res.status(405).json({ Error: "Acceptable reqests to /boats/:boat_id: GET, PUT, DELETE, PATCH" });
})

//----------------------------------------------------------------------------

module.exports = router;
