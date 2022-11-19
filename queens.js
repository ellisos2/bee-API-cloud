const express = require('express');
const bodyParser = require('body-parser');

const ds = require('./datastore');
const { BOATS, LOADS } = require('./constants');
//const removeLoad = require('./boats').removeLoad;

const router = express.Router();

const datastore = ds.datastore;

router.use(bodyParser.json());

//----------------------------------------------------------------------------
// Model functions related to LOAD entities.
//----------------------------------------------------------------------------

/**
 * Function to create a new load.
 * 
 * Schema: 
 *  volume (integer): volume of the load
 *  item (string): item in this load
 *  creation_date (date): date the load was created
 *  carrier (object): boat carrying this item (initialized to null)
 */
function createLoad (req, volume, item, creationDate) {
    var newLoadKey = datastore.key(LOADS);
    const newLoad = { "volume": volume, "item": item, "creation_date": creationDate, "carrier": null };
    const load = { "key": newLoadKey, "data": newLoad };

    return datastore.save(load).then(() => {
        const self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + newLoadKey.id;
        return { "id": newLoadKey.id, ...newLoad, "self": self };
    });
};

/**
 * Retrieve all loads.
 */
function getLoads (req) {
    const loadsQuery = datastore.createQuery(LOADS).limit(3);

    var foundLoads = {};
    var foundLoadsInfo = {};

    return datastore.runQuery(loadsQuery)
        .then((loads) => {
            foundLoads.loads = loads[0]; // load entities as a list
            foundLoadsInfo = loads[1]; // query information
            foundLoads.loads.map(ds.fromDatastore);
            
            // add a link to the next page of results if there are more results remaining
            if (foundLoadsInfo.moreResults !== datastore.NO_MORE_RESULTS) {
                foundLoads.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + foundLoadsInfo.endCursor;
            }

            return foundLoads;
        });
};

/**
 * Retrieve the load with the given ID.
 * If not found, throw an error.
 * Response includes the self link.
 */
function getLoad (req, id) {
    const loadKey = datastore.key([LOADS, parseInt(id, 10)]);

    return datastore.get(loadKey).then((load) => {
        // Do nothing if the boat is not found. 
        if (load[0] === undefined || load[0] === null) {
            throw new Error("Load not found");
        } else {
            // Save self link and return object containining all boat data
            const loadRes = load.map(ds.fromDatastore)[0];
            const self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + loadRes.id;
            loadRes.self = self;
            return loadRes;
        };
    });
};

/**
 * Delete the load with the given load_id. If this load is associated with a boat,
 * remove the load from the boat's list of loads.
 * If not found, throw an error.
 */
function deleteLoad (req, loadId) {
    const loadKey = datastore.key([LOADS, parseInt(loadId, 10)]);

    return datastore.get(loadKey)
        .then((load) => {
            if (load[0] == null) {
                console.log(1);
                throw new Error("Load not found");
            } else if (load[0].carrier != null) {
                const boatId = load[0].carrier.id;
                return removeLoad(req, boatId, loadId);
            } else {
                return;
            };
        })
        .then(() => {
            return datastore.delete(loadKey);
        });
};

//----------------------------------------------------------------------------
// Controller functions related to LOAD entities.
//----------------------------------------------------------------------------

/**
 * Handle POST requests to /loads to create a new load. A new load will not
 * be created if volume, item, or creation_date is missing from the request.
 */
router.post('/', function (req, res) {

    if (req.body.volume === undefined || req.body.item === undefined || req.body.creation_date === undefined) {
        res.status(400).json({ Error: 'The request object is missing at least one of the required attributes' });
    } else {
        createLoad(req, req.body.volume, req.body.item, req.body.creation_date)
            .then(load => {
                res.status(201).json(load);
            })
    };
});

/**
 * Handle GET requests to /loads to get all loads, with pagination and a page limit of 3.
 */
router.get('/', function (req, res) {
    getLoads(req)
        .then(loads => {
            res.status(200).json(loads);
        });
});

/**
 * Handle GET requests to /loads/:load_id to get the load with the given ID.
 * Response is a 404 error if no load is found with given ID.
 */
router.get('/:load_id', function (req, res) {
    getLoad(req, req.params.load_id)
        .then(load => {
            res.status(200).json(load);
        })
        .catch(error => {
            res.status(404).json({ Error: 'No load with this load_id exists' });
        });
});

/**
 * Handle DELETE requests to /loads/:load_id to delete the load with the given ID.
 * The load is removed from its associated boat, if applicable.
 * Response is a 404 error if no load is found with given ID.
 */
router.delete('/:load_id', function (req, res) {
    deleteLoad(req, req.params.load_id)
        .then(() => {
            res.status(204).end();
        })
        .catch(error => {
            res.status(404).json({ Error: 'No load with this load_id exists' });
        });
});

//----------------------------------------------------------------------------

module.exports = router;
