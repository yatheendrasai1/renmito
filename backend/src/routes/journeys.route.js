const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/journeys.controller');

router.get('/',                          ctrl.listJourneys);
router.post('/',                         ctrl.createJourney);
router.get('/:id',                       ctrl.getJourney);
router.put('/:id',                       ctrl.updateJourney);
router.delete('/:id',                    ctrl.deleteJourney);

router.post('/:id/resync',               ctrl.resyncJourney);
router.get('/:id/entries',               ctrl.listEntries);
router.post('/:id/entries',              ctrl.addEntry);
router.put('/:id/entries/:entryId',      ctrl.updateEntry);
router.delete('/:id/entries/:entryId',   ctrl.deleteEntry);

module.exports = router;
