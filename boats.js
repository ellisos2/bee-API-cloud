const express = require('express');
const bodyParser = require('body-parser');

const json2html = require('node-json2html');
const ds = require('./datastore');
const { BOATS } = require('./constants');

const router = express.Router();

const datastore = ds.datastore;

router.use(bodyParser.json());


/**
 * Convert the object resObj to an HTML format and send the file in the response
 * with the given status code.
 */
function sendHTML(res, statusCode, resObj) {
    // Learned to use the json2html library based on examples from the json2html 
    // Get Started guide.
    // https://json2html.com/started/

    var template = {'<>':'ul','html':[
        {'<>':'li','html':function(){return("name: " + this.name)}},
        {'<>':'li','html':function(){return("type: " + this.type)}},
        {'<>':'li','html':function(){return("id: " + this.id)}},
        {'<>':'li','html':function(){return("length: " + this.length)}},
        {'<>':'li','html':function(){return("self: " + this.self)}}
    ]};
    res.set("Content-Type", "text/html");
    res.status(statusCode).send(json2html.render(resObj, template));
};

//----------------------------------------------------------------------------
// Verificiation functions used to validate request input.
//----------------------------------------------------------------------------

/**
 * Verify that the boat name is not already in use by another boat,
 * that the name is less than 50 characters, and that the name uses
 * only spaces and alphanumeric characters.
 */
function verifyName (name) {
    const allBoats = datastore.createQuery(BOATS)
    
    // Information about Regular Expressions learned through trial and error
    // based on the 'Regular Expressions Quick Start' Guide.
    // from: https://www.regular-expressions.info/quickstart.html
    const valid = /^[a-zA-Z0-9 ]+$/;

    var foundBoats = [];
    return datastore.runQuery(allBoats)
        .then((result) => {
            foundBoats = result[0]  // [0] index holds list of boats
            foundBoats.map(ds.fromDatastore);

            // throw an error if the boat name is too long
            if (name.length > 50) {
                throw new Error("name/type too long");
            // throw an error if the boat type contains non-alphanumeric characters
            } else if (!valid.test(name)) {
                throw new Error("invalid characters");
            } else {
            // throw an error if the boat name is used by another boat
                for (boat of foundBoats) {
                    if (boat.name === name) {
                        throw new Error("name already in use");
                    }
                }    
                return;
            }
        });
};

/**
 * Verify that the boat type is less than 50 characters and uses
 * only spaces and alphanumeric characters.
 */
function verifyType (type) {
    // Information about Regular Expressions learned through trial and error
    // based on the 'Regular Expressions Quick Start' Guide.
    // from: https://www.regular-expressions.info/quickstart.html
    const valid = /^[a-zA-Z0-9 ]+$/;

    // throw an error if the boat type is too long
    if (type.length > 50) {
        throw new Error("name/type too long");
    // throw an error if the boat type contains non-alphanumeric characters
    } else if (!valid.test(type)) {
        throw new Error("invalid characters");
    } else {
        return;
    };
};

/**
 * Verify that the boat length is an integer that is within the 
 * interval [0, 100,000].
 */
function verifyLength (length) {
    // throw an error if the boat name is too long
    if (typeof(length) !== "number") {
        throw new Error("invalid characters");
    } else if (!Number.isInteger(length)) {
        throw new Error("invalid characters");
    } else if (length > 100000 || length < 0) {
        throw new Error("length out of bounds");
    } else {
        return;
    };
};

//----------------------------------------------------------------------------
// Model functions related to BOAT entities.
//----------------------------------------------------------------------------

/**
 * Function to create a new boat.
 * 
 * Schema: 
 *  name (string): name of the boat
 *  type (string): type of the boat (e.g. sailboat)
 *  length (integer): length of the boat
 * 
 * Input Notes: Only names that are =< 50 characters will allow for creation.
 * Additionally, all atttributes must be alphanumeric, and the length must be an integer.
 */
function createBoat (req, name, type, length) {
    var newBoatKey = datastore.key(BOATS);
    const newBoat = { "name": name, "type": type, "length": length };
    const boat = { "key": newBoatKey, "data": newBoat };
    
    // Verify name, type, and length before saving to datastore
    return verifyName(name)
        .then(() => {
            verifyType(type);
        })
        .then(() => {
            verifyLength(length);
        })
        .then(() => {
            return datastore.save(boat)
        })
        .then(() => {
            const self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + newBoatKey.id;
            return { "id": newBoatKey.id, ...newBoat, "self": self };
        })
        .catch(error => {
            throw error;
        });
};

/**
 * Retrieve all boats. The results will be paginated to a size of 5, and a link to the
 * next 5 results. 
 */
function getBoats (req) {
    const boatsQuery = datastore.createQuery(BOATS).limit(5);

    var foundBoats = {};
    var foundBoatsInfo = {};

    return datastore.runQuery(boatsQuery)
        .then((boats) => {
            foundBoats.boats = boats[0]; // boat entities as a list
            foundBoatsInfo = boats[1]; // query information
            foundBoats.boats.map(ds.fromDatastore);
            
            // add a link to the next page of results if there are more results remaining
            if (foundBoatsInfo.moreResults !== datastore.NO_MORE_RESULTS) {
                foundBoats.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + foundBoatsInfo.endCursor;
            }

            return foundBoats;
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
// Controller functions related to BOAT entities.
//----------------------------------------------------------------------------

/**
 * Handle POST requests to /boats to create a new boat. A new boat will not
 * be created if name, type, or length is missing from the request.
 */
router.post('/', function (req, res) {
    if (req.get("Content-Type") !== "application/json") {
        res.status(415).json({ Error: "Unsupported MIME type received - server can only accept application/json" });
    } else if (req.body.name === undefined || req.body.type === undefined || req.body.length === undefined) {
        res.status(400).json({ Error: 'The request object is missing at least one of the required attributes' });
    } else {
        createBoat(req, req.body.name, req.body.type, req.body.length)
            .then(boat => {
                // req.accepts() returns content type if found, and False if none found
                // Source: https://www.tutorialspoint.com/express-js-req-accepts-method
                const accepts = req.accepts(["application/json"]);
                
                if (!accepts) {
                    res.status(406).json({ Error: "Unsupported MIME type requested - only application/json supported" });
                } else if (accepts === "application/json") {
                    res.set("Content-Type", "application/json");
                    res.status(201).json(boat);
                } else {
                    res.status(500).send("Unknown server error")
                }
            })
            .catch(error => {
                if (error.message === "name already in use") {
                    res.status(403).json({ Error: "That boat name is already in use" });
                } else if (error.message === "name/type too long") {
                    res.status(400).json({ Error: "That boat name or type is too long (must be =< 50 characters)" });
                } else if (error.message === "invalid characters") {
                    res.status(400).json({ Error: "name and type must include only alphanumeric characters and length must be a positive integer" })
                } else if (error.message === "length out of bounds") {
                    res.status(400).json({ Error: "length must be an integer value in the interval [0, 100,000]" })
                }
            });
    };
});

/**
 * Handle GET requests to /boats to get all boats. 3 boats will be listed per page, along
 * with a link to the next 3 boats, if any.
 */
router.get('/', function (req, res) {
    getBoats(req)
        .then(boats => {
            res.status(200).json(boats);
        });
});

/**
 * Warn that PUT requests to /boats are not supported.
 */
router.put('/', function (req, res) {
    res.set('Accept', 'Get, Post');
    res.status(405).json({ Error: "Acceptable reqests to /boats: GET, POST" });
});

/**
 * Warn that DELETE requests to /boats are not supported.
 */
router.delete('/', function (req, res) {
    res.set('Accept', 'Get, Post');
    res.status(405).json({ Error: "Acceptable reqests to /boats: GET, POST" });
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
