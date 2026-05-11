const express    = require('express');
const controller = require('../controllers/seasons.controller');

const router = express.Router();

router.get('/',    controller.listSeasons);
router.post('/',   controller.createSeason);
router.put('/:id', controller.updateSeason);
router.delete('/:id', controller.deleteSeason);

module.exports = router;
