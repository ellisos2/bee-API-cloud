const router = module.exports = require('express').Router();

router.use('/boats', require('./boats'));
router.use('/', require('./login'));
router.use('/oauth', require('./login'));
