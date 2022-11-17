const router = module.exports = require('express').Router();

router.use('/beekeepers', require('./beekeepers'));
router.use('/hives', require('./hives'));
router.use('/queens', require('./queens'));
router.use('/', require('./login'));
router.use('/oauth', require('./login'));
