const express    = require('express');
const controller = require('../controllers/notes.controller');

const router = express.Router();

router.get('/:date',                   controller.getNotes);
router.post('/:date/notes',            controller.addNote);
router.put('/:date/notes/:noteId',     controller.updateNote);
router.delete('/:date/notes/:noteId',  controller.deleteNote);

module.exports = router;
