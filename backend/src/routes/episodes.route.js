const express    = require('express');
const controller = require('../controllers/episodes.controller');

const router = express.Router();

router.get('/:date',    controller.getEpisode);
router.put('/:date',    controller.upsertEpisode);
router.delete('/:date', controller.deleteEpisode);

module.exports = router;
