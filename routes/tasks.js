var express = require('express');
var User = require('../models/user');
var Task = require('../models/task');
var helpers = require('./helpers');
var router = express.Router();

async function writeTask(req, replacing) {
    return helpers.transaction(async function (session) {
        var task = replacing ? await helpers.findResource(Task, req.params.id, session) : new Task();
        var fields = helpers.taskFields(req.body);
        if (fields.assignedUser) {
            var user = await User.findById(fields.assignedUser).session(session);
            if (!user) helpers.fail(404, 'Assigned user not found');
            if (req.body.assignedUserName !== undefined && req.body.assignedUserName !== user.name) {
                helpers.fail(400, 'Assigned user name does not match the user');
            }
            fields.assignedUserName = user.name;
        }

        var id = task._id.toString();
        if (task.assignedUser) {
            await User.updateOne({ _id: task.assignedUser }, { $pull: { pendingTasks: id } }, { session });
        }
        task.set(fields);
        await task.save({ session });
        if (fields.assignedUser && !fields.completed) {
            await User.updateOne({ _id: fields.assignedUser }, { $addToSet: { pendingTasks: id } }, { session });
        }
        return task.toObject();
    });
}

router.get('/', async function (req, res) {
    res.json({ message: 'OK', data: await helpers.collection(Task, req.query, 100) });
});

router.post('/', async function (req, res) {
    res.status(201).json({ message: 'Task created', data: await writeTask(req, false) });
});

router.get('/:id', async function (req, res) {
    res.json({ message: 'OK', data: await helpers.item(Task, req) });
});

router.put('/:id', async function (req, res) {
    res.json({ message: 'Task updated', data: await writeTask(req, true) });
});

router.delete('/:id', async function (req, res) {
    await helpers.transaction(async function (session) {
        var task = await helpers.findResource(Task, req.params.id, session);
        if (task.assignedUser) {
            await User.updateOne({ _id: task.assignedUser }, {
                $pull: { pendingTasks: task._id.toString() }
            }, { session });
        }
        await task.deleteOne({ session });
    });
    res.status(204).end();
});

module.exports = router;
